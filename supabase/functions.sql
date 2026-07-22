-- 증거금 설정 플로우: 잔고 이동을 원자적으로 처리하는 RPC 함수 4종
-- Supabase 대시보드 > SQL Editor 에서 직접 실행해줘 (이 리포에서 자동 실행되지 않음).
-- accounts(user_id, upbit_krw, upbit_usdt, okx_funding_usdt, okx_trading_usdt, initial_krw, initial_usdt)
-- transactions(user_id, type, detail jsonb, created_at) 테이블이 이미 존재한다고 가정.
-- 각 함수는 SECURITY INVOKER(기본값)로 호출자 RLS를 그대로 적용받음 —
-- accounts/transactions에 "본인 행만 select/update/insert 가능" RLS 정책이 이미 있어야 정상 동작함.

create or replace function deposit_upbit_krw(p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_initial_krw numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount < 1000000 or p_amount > 100000000 then
    raise exception 'invalid_amount';
  end if;

  select initial_krw into v_initial_krw
    from accounts where user_id = v_uid for update;

  if v_initial_krw is null then
    raise exception 'account_not_found';
  end if;
  if v_initial_krw <> 0 then
    raise exception 'already_deposited';
  end if;

  update accounts
    set upbit_krw = p_amount,
        initial_krw = p_amount
    where user_id = v_uid;

  insert into transactions (user_id, type, detail)
    values (v_uid, 'upbit_deposit', jsonb_build_object('amount_krw', p_amount));
end;
$$;

create or replace function buy_usdt_all(p_rate numeric)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_krw numeric;
  v_usdt numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid_rate';
  end if;

  select upbit_krw into v_krw
    from accounts where user_id = v_uid for update;

  if v_krw is null then
    raise exception 'account_not_found';
  end if;
  if v_krw <= 0 then
    raise exception 'no_balance';
  end if;

  v_usdt := round(v_krw / p_rate, 2);

  update accounts
    set upbit_krw = 0,
        upbit_usdt = upbit_usdt + v_usdt
    where user_id = v_uid;

  insert into transactions (user_id, type, detail)
    values (
      v_uid,
      'usdt_buy',
      jsonb_build_object('krw_amount', v_krw, 'rate', p_rate, 'usdt_amount', v_usdt)
    );
end;
$$;

create or replace function transfer_to_okx_funding()
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_usdt numeric;
  v_initial_usdt numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select upbit_usdt, initial_usdt into v_usdt, v_initial_usdt
    from accounts where user_id = v_uid for update;

  if v_usdt is null then
    raise exception 'account_not_found';
  end if;
  if v_initial_usdt <> 0 then
    raise exception 'already_finalized';
  end if;
  if v_usdt <= 0 then
    raise exception 'no_balance';
  end if;

  update accounts
    set upbit_usdt = 0,
        okx_funding_usdt = okx_funding_usdt + v_usdt,
        initial_usdt = v_usdt
    where user_id = v_uid;

  insert into transactions (user_id, type, detail)
    values (v_uid, 'okx_transfer', jsonb_build_object('usdt_amount', v_usdt));
end;
$$;

create or replace function wallet_transfer(p_direction text, p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_funding numeric;
  v_trading numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_direction not in ('funding_to_trading', 'trading_to_funding') then
    raise exception 'invalid_direction';
  end if;

  select okx_funding_usdt, okx_trading_usdt into v_funding, v_trading
    from accounts where user_id = v_uid for update;

  if v_funding is null then
    raise exception 'account_not_found';
  end if;

  if p_direction = 'funding_to_trading' then
    if p_amount > v_funding then
      raise exception 'insufficient_balance';
    end if;
    update accounts
      set okx_funding_usdt = okx_funding_usdt - p_amount,
          okx_trading_usdt = okx_trading_usdt + p_amount
      where user_id = v_uid;
  else
    if p_amount > v_trading then
      raise exception 'insufficient_balance';
    end if;
    update accounts
      set okx_trading_usdt = okx_trading_usdt - p_amount,
          okx_funding_usdt = okx_funding_usdt + p_amount
      where user_id = v_uid;
  end if;

  insert into transactions (user_id, type, detail)
    values (v_uid, 'wallet_transfer', jsonb_build_object('direction', p_direction, 'amount', p_amount));
end;
$$;

-- ===== 선물 진입 (트레이딩 화면) =====
-- 이 함수는 클라이언트가 절대 직접 호출할 수 없어야 함 (진입가 조작 방지).
-- auth.uid()를 쓰지 않고 p_user_id를 명시적으로 받는 이유:
-- Next.js 서버 액션이 SUPABASE_SERVICE_ROLE_KEY로만 호출하도록 잠글 것이라
-- 이 호출에는 사용자 JWT 컨텍스트(auth.uid())가 존재하지 않기 때문.
-- 아래 revoke/grant 문으로 authenticated/anon 롤의 실행 권한을 반드시 제거해야 함.
-- positions(user_id, symbol, side, margin, leverage, qty, entry_price, notional,
--           open_fee, liq_price, status, opened_at) 테이블이 이미 존재한다고 가정.
-- positions.id는 uuid 타입 — 기존에 bigint로 만들었다면 return type을 바꿀 수 없으니 먼저 drop.
drop function if exists open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
);

create or replace function open_position(
  p_user_id uuid,
  p_symbol text,
  p_side text,
  p_margin numeric,
  p_leverage numeric,
  p_entry_price numeric,
  p_qty numeric,
  p_notional numeric,
  p_open_fee numeric,
  p_liq_price numeric
)
returns uuid
language plpgsql
as $$
declare
  v_trading numeric;
  v_open_count int;
  v_required numeric;
  v_position_id uuid;
begin
  if p_symbol not in ('BTC-USDT-SWAP', 'ETH-USDT-SWAP') then
    raise exception 'invalid_symbol';
  end if;
  if p_side not in ('long', 'short') then
    raise exception 'invalid_side';
  end if;
  if p_margin is null or p_margin <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_leverage is null or p_leverage < 1 or p_leverage > 100 then
    raise exception 'invalid_leverage';
  end if;

  select okx_trading_usdt into v_trading
    from accounts where user_id = p_user_id for update;

  if v_trading is null then
    raise exception 'account_not_found';
  end if;

  select count(*) into v_open_count
    from positions where user_id = p_user_id and status = 'open';

  if v_open_count >= 5 then
    raise exception 'max_positions';
  end if;

  v_required := p_margin + p_open_fee;
  if v_required > v_trading then
    raise exception 'insufficient_balance';
  end if;

  update accounts
    set okx_trading_usdt = okx_trading_usdt - v_required
    where user_id = p_user_id;

  insert into positions (
    user_id, symbol, side, margin, leverage, qty, entry_price,
    open_fee, liq_price, status, opened_at
  ) values (
    p_user_id, p_symbol, p_side, p_margin, p_leverage, p_qty, p_entry_price,
    p_open_fee, p_liq_price, 'open', now()
  ) returning id into v_position_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      'position_open',
      jsonb_build_object(
        'position_id', v_position_id,
        'symbol', p_symbol,
        'side', p_side,
        'margin', p_margin,
        'leverage', p_leverage,
        'entry_price', p_entry_price,
        'qty', p_qty,
        'open_fee', p_open_fee
      )
    );

  return v_position_id;
end;
$$;

revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public;
revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from anon;
revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from authenticated;
grant execute on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to service_role;

-- ===== 선물 청산 (시장가 전량 청산) =====
-- open_position과 동일한 이유로 클라이언트 직접 호출 차단: 체결가 조작 방지.
-- positions에 close_price(numeric), realized_pnl(numeric), closed_at(timestamptz) 컬럼이
-- 이미 존재한다고 확인됨.
create or replace function close_position(
  p_user_id uuid,
  p_position_id uuid,
  p_close_price numeric,
  p_close_fee numeric,
  p_realized numeric,
  p_return_to_balance numeric
)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
    from positions
    where id = p_position_id and user_id = p_user_id
    for update;

  if v_status is null then
    raise exception 'position_not_found';
  end if;
  if v_status <> 'open' then
    raise exception 'already_closed';
  end if;

  update positions
    set status = 'closed',
        close_price = p_close_price,
        realized_pnl = p_realized,
        closed_at = now()
    where id = p_position_id;

  update accounts
    set okx_trading_usdt = okx_trading_usdt + p_return_to_balance
    where user_id = p_user_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      'position_close',
      jsonb_build_object(
        'position_id', p_position_id,
        'close_price', p_close_price,
        'close_fee', p_close_fee,
        'realized_pnl', p_realized,
        'return_to_balance', p_return_to_balance
      )
    );
end;
$$;

revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric
) from public;
revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric
) from anon;
revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric
) from authenticated;
grant execute on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric
) to service_role;

-- ===== 강제청산 (liquidation-check 크론 Edge Function 전용) =====
-- 클라이언트 직접 호출 차단 이유는 open_position/close_position과 동일: 체결가 조작 방지.
-- 이중 처리 방지: status='open'인 행만 잠가서 처리하고, 아니면 false를 반환해 조용히 스킵한다
-- (raise exception을 쓰지 않는 이유는 크론이 여러 포지션을 순회하며 호출하는 배치 성격이라
--  이미 처리된 건은 예외 없이 skip으로 취급하는 편이 호출 측 로직이 단순해지기 때문).
create or replace function liquidate_position(
  p_position_id uuid,
  p_close_price numeric
)
returns boolean
language plpgsql
as $$
declare
  v_status text;
  v_user_id uuid;
  v_margin numeric;
begin
  select status, user_id, margin into v_status, v_user_id, v_margin
    from positions
    where id = p_position_id
    for update;

  if v_status is null or v_status <> 'open' then
    return false;
  end if;

  update positions
    set status = 'liquidated',
        close_price = p_close_price,
        realized_pnl = -v_margin,
        closed_at = now()
    where id = p_position_id;

  insert into transactions (user_id, type, detail)
    values (
      v_user_id,
      'liquidation',
      jsonb_build_object(
        'position_id', p_position_id,
        'close_price', p_close_price,
        'realized_pnl', -v_margin
      )
    );

  return true;
end;
$$;

revoke all on function liquidate_position(uuid, numeric) from public;
revoke all on function liquidate_position(uuid, numeric) from anon;
revoke all on function liquidate_position(uuid, numeric) from authenticated;
grant execute on function liquidate_position(uuid, numeric) to service_role;

-- ===== TP/SL 컬럼 추가 =====
alter table positions add column if not exists tp_price numeric;
alter table positions add column if not exists sl_price numeric;

-- ===== open_position에 tp/sl 저장 지원 추가 =====
-- 기존 파라미터 끝에 두 개를 default null로 추가하는 방식이라 CREATE OR REPLACE로
-- 기존 함수를 그대로 갱신함 (drop 불필요, 기존 권한도 유지됨).
create or replace function open_position(
  p_user_id uuid,
  p_symbol text,
  p_side text,
  p_margin numeric,
  p_leverage numeric,
  p_entry_price numeric,
  p_qty numeric,
  p_notional numeric,
  p_open_fee numeric,
  p_liq_price numeric,
  p_tp_price numeric default null,
  p_sl_price numeric default null
)
returns uuid
language plpgsql
as $$
declare
  v_trading numeric;
  v_open_count int;
  v_required numeric;
  v_position_id uuid;
begin
  if p_symbol not in ('BTC-USDT-SWAP', 'ETH-USDT-SWAP') then
    raise exception 'invalid_symbol';
  end if;
  if p_side not in ('long', 'short') then
    raise exception 'invalid_side';
  end if;
  if p_margin is null or p_margin <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_leverage is null or p_leverage < 1 or p_leverage > 100 then
    raise exception 'invalid_leverage';
  end if;

  select okx_trading_usdt into v_trading
    from accounts where user_id = p_user_id for update;

  if v_trading is null then
    raise exception 'account_not_found';
  end if;

  select count(*) into v_open_count
    from positions where user_id = p_user_id and status = 'open';

  if v_open_count >= 5 then
    raise exception 'max_positions';
  end if;

  v_required := p_margin + p_open_fee;
  if v_required > v_trading then
    raise exception 'insufficient_balance';
  end if;

  update accounts
    set okx_trading_usdt = okx_trading_usdt - v_required
    where user_id = p_user_id;

  insert into positions (
    user_id, symbol, side, margin, leverage, qty, entry_price,
    open_fee, liq_price, tp_price, sl_price, status, opened_at
  ) values (
    p_user_id, p_symbol, p_side, p_margin, p_leverage, p_qty, p_entry_price,
    p_open_fee, p_liq_price, p_tp_price, p_sl_price, 'open', now()
  ) returning id into v_position_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      'position_open',
      jsonb_build_object(
        'position_id', v_position_id,
        'symbol', p_symbol,
        'side', p_side,
        'margin', p_margin,
        'leverage', p_leverage,
        'entry_price', p_entry_price,
        'qty', p_qty,
        'open_fee', p_open_fee,
        'tp_price', p_tp_price,
        'sl_price', p_sl_price
      )
    );

  return v_position_id;
end;
$$;

revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public;
revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from anon;
revoke all on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from authenticated;
grant execute on function open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) to service_role;

-- ===== close_position에 정산 사유(reason) 파라미터 추가 =====
-- p_reason으로 transactions.type을 그대로 채움: 수동 청산은 기본값 'position_close',
-- 크론의 TP/SL 자동 정산은 이 동일 RPC를 'tp'/'sl'로 호출해 재사용한다.
create or replace function close_position(
  p_user_id uuid,
  p_position_id uuid,
  p_close_price numeric,
  p_close_fee numeric,
  p_realized numeric,
  p_return_to_balance numeric,
  p_reason text default 'position_close'
)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status
    from positions
    where id = p_position_id and user_id = p_user_id
    for update;

  if v_status is null then
    raise exception 'position_not_found';
  end if;
  if v_status <> 'open' then
    raise exception 'already_closed';
  end if;

  update positions
    set status = 'closed',
        close_price = p_close_price,
        realized_pnl = p_realized,
        closed_at = now()
    where id = p_position_id;

  update accounts
    set okx_trading_usdt = okx_trading_usdt + p_return_to_balance
    where user_id = p_user_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      p_reason,
      jsonb_build_object(
        'position_id', p_position_id,
        'close_price', p_close_price,
        'close_fee', p_close_fee,
        'realized_pnl', p_realized,
        'return_to_balance', p_return_to_balance
      )
    );
end;
$$;

revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric, text
) from public;
revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric, text
) from anon;
revoke all on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric, text
) from authenticated;
grant execute on function close_position(
  uuid, uuid, numeric, numeric, numeric, numeric, text
) to service_role;

-- ===== 랭킹 집계를 서버(서비스롤)에서 직접 하도록 변경하면서 더 이상 안 쓰는 뷰 제거 =====
-- Supabase 린터의 "Security Definer View" CRITICAL 경고 해소.
drop view if exists public.rankings;

-- ===== 지갑 관리: 출금(역방향) 플로우 =====
-- 입금 플로우(deposit_upbit_krw → buy_usdt_all → transfer_to_okx_funding)의 역순.
-- 1회성 마법사가 아니라 wallet_transfer처럼 금액을 직접 입력하는 반복 가능한 이체이므로
-- initial_krw/initial_usdt 같은 완료 플래그는 두지 않는다.

create or replace function withdraw_to_upbit(p_amount numeric)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_funding numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select okx_funding_usdt into v_funding
    from accounts where user_id = v_uid for update;

  if v_funding is null then
    raise exception 'account_not_found';
  end if;
  if p_amount > v_funding then
    raise exception 'insufficient_balance';
  end if;

  update accounts
    set okx_funding_usdt = okx_funding_usdt - p_amount,
        upbit_usdt = upbit_usdt + p_amount
    where user_id = v_uid;

  insert into transactions (user_id, type, detail)
    values (v_uid, 'okx_withdraw', jsonb_build_object('usdt_amount', p_amount));
end;
$$;

-- p_rate는 호출부(Next.js 서버 액션)가 getUsdtKrw()로 그 순간 재조회한 값만 받는다.
-- 클라이언트가 화면에 보여준 환율을 그대로 신뢰하지 않기 위함(buy_usdt_all과 동일한 이유).
create or replace function sell_usdt_to_krw(p_amount numeric, p_rate numeric)
returns void
language plpgsql
as $$
declare
  v_uid uuid := auth.uid();
  v_usdt numeric;
  v_krw numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid_rate';
  end if;

  select upbit_usdt into v_usdt
    from accounts where user_id = v_uid for update;

  if v_usdt is null then
    raise exception 'account_not_found';
  end if;
  if p_amount > v_usdt then
    raise exception 'insufficient_balance';
  end if;

  v_krw := round(p_amount * p_rate);

  update accounts
    set upbit_usdt = upbit_usdt - p_amount,
        upbit_krw = upbit_krw + v_krw
    where user_id = v_uid;

  insert into transactions (user_id, type, detail)
    values (
      v_uid,
      'usdt_sell',
      jsonb_build_object('usdt_amount', p_amount, 'rate', p_rate, 'krw_amount', v_krw)
    );
end;
$$;

-- ===== 버그 수정: close_position/open_position 옛 오버로드 제거 =====
-- CREATE OR REPLACE FUNCTION은 파라미터 개수가 바뀌면 기존 함수를 덮어쓰지 않고
-- 별도 오버로드로 추가해버림. p_reason(close_position)/p_tp_price·p_sl_price(open_position)를
-- 추가할 때 옛 시그니처를 안 지워서, close_position은 p_reason 없이(6개 인자) 호출하면
-- PostgREST가 "옛 함수 직접 호출"과 "새 함수의 기본값 사용" 사이에서 선택 못 해
-- PGRST203(Could not choose the best candidate function) 에러를 냄 — 수동 청산이 이 경로였음.
-- open_position은 호출부가 항상 12개 인자를 다 넘겨서 실사용 버그는 없었지만
-- 같은 종류의 잠재 문제라 옛 10-인자 오버로드도 함께 정리.
drop function if exists close_position(
  uuid, uuid, numeric, numeric, numeric, numeric
);
drop function if exists open_position(
  uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
);

-- ===== 보안 강화: sell_usdt_to_krw를 open_position/close_position과 동일하게 서비스롤 전용으로 잠금 =====
-- 기존 sell_usdt_to_krw(p_amount, p_rate)는 SECURITY INVOKER + authenticated 실행 권한이
-- 있어서, Next.js를 거치지 않고 사용자가 자기 JWT로 직접 이 RPC를 호출하면 p_rate에
-- 임의의 값(예: 비정상적으로 높은 환율)을 넣어 원화를 부풀릴 수 있는 구멍이 있었다.
--
-- open_position/close_position이 이미 쓰고 있는 패턴을 그대로 적용해서 막는다:
-- auth.uid() 대신 p_user_id를 명시적으로 받고, authenticated/anon 실행 권한을 revoke해서
-- SUPABASE_SERVICE_ROLE_KEY로만(즉 Next.js 서버 액션에서만) 호출 가능하게 한다.
-- 서버 액션은 이미 이 호출 직전에 getUsdtKrw()로 환율을 직접 재조회해서 넘기고 있으므로
-- (클라이언트가 화면에 보여준 값이 아니라), 이 RPC를 직접 호출할 방법 자체를 없애면
-- p_rate가 진짜로 "그 순간 서버가 조회한 값"이라는 게 보장된다.
--
-- rates 테이블에 주기적으로 시세를 적재해두고 RPC가 그걸 읽게 하는 방식(요청받은 "방법 A")도
-- 고려했지만, 그러려면 새 테이블 + 별도 주기 실행 크론/Edge Function이 필요해서 배포 부담이
-- 크다. 오차범위 검증(방법 B) 역시 결국 같은 "서버가 기록해둔 최신 환율"이 있어야 비교가
-- 가능해서 인프라 부담은 동일하다. 반면 이 방식은 새 인프라 없이, 이미 이 저장소에 있는
-- open_position/close_position과 완전히 같은 신뢰 모델을 재사용한다.
drop function if exists sell_usdt_to_krw(numeric, numeric);

create or replace function sell_usdt_to_krw(
  p_user_id uuid,
  p_amount numeric,
  p_rate numeric
)
returns void
language plpgsql
as $$
declare
  v_usdt numeric;
  v_krw numeric;
begin
  if p_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid_rate';
  end if;

  select upbit_usdt into v_usdt
    from accounts where user_id = p_user_id for update;

  if v_usdt is null then
    raise exception 'account_not_found';
  end if;
  if p_amount > v_usdt then
    raise exception 'insufficient_balance';
  end if;

  v_krw := round(p_amount * p_rate);

  update accounts
    set upbit_usdt = upbit_usdt - p_amount,
        upbit_krw = upbit_krw + v_krw
    where user_id = p_user_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      'usdt_sell',
      jsonb_build_object('usdt_amount', p_amount, 'rate', p_rate, 'krw_amount', v_krw)
    );
end;
$$;

revoke all on function sell_usdt_to_krw(uuid, numeric, numeric) from public;
revoke all on function sell_usdt_to_krw(uuid, numeric, numeric) from anon;
revoke all on function sell_usdt_to_krw(uuid, numeric, numeric) from authenticated;
grant execute on function sell_usdt_to_krw(uuid, numeric, numeric) to service_role;

-- ===== 보안 강화: buy_usdt_all도 동일한 이유로 서비스롤 전용으로 잠금 =====
-- sell_usdt_to_krw와 완전히 같은 취약점: 기존 buy_usdt_all(p_rate)는 SECURITY INVOKER +
-- authenticated 실행 권한이 있어서, 사용자가 자기 JWT로 직접 호출하며 p_rate에 비정상적으로
-- 낮은 값을 넣으면 실제보다 훨씬 많은 USDT를 받아갈 수 있었다. open_position/close_position/
-- sell_usdt_to_krw와 동일한 패턴으로 잠근다.
drop function if exists buy_usdt_all(numeric);

create or replace function buy_usdt_all(p_user_id uuid, p_rate numeric)
returns void
language plpgsql
as $$
declare
  v_krw numeric;
  v_usdt numeric;
begin
  if p_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_rate is null or p_rate <= 0 then
    raise exception 'invalid_rate';
  end if;

  select upbit_krw into v_krw
    from accounts where user_id = p_user_id for update;

  if v_krw is null then
    raise exception 'account_not_found';
  end if;
  if v_krw <= 0 then
    raise exception 'no_balance';
  end if;

  v_usdt := round(v_krw / p_rate, 2);

  update accounts
    set upbit_krw = 0,
        upbit_usdt = upbit_usdt + v_usdt
    where user_id = p_user_id;

  insert into transactions (user_id, type, detail)
    values (
      p_user_id,
      'usdt_buy',
      jsonb_build_object('krw_amount', v_krw, 'rate', p_rate, 'usdt_amount', v_usdt)
    );
end;
$$;

revoke all on function buy_usdt_all(uuid, numeric) from public;
revoke all on function buy_usdt_all(uuid, numeric) from anon;
revoke all on function buy_usdt_all(uuid, numeric) from authenticated;
grant execute on function buy_usdt_all(uuid, numeric) to service_role;
