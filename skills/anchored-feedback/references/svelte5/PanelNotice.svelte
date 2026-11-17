<script lang="ts">
  /**
   * 패널에 붙는 상태줄·배너(시안 1b·2a). 패널 마크업 안에 한 번 둔다.
   *
   *   <PanelNotice scope="query" placement="bottom" />   → 앵커 id `query.panel`
   *
   * 자기 루트가 곧 `scope.panel` 앵커라서, 항목이 없어도 요소는 남아 있다(높이 0).
   * 가장 최근 항목 하나만 한 줄로 보여 준다 — 쌓이지 않는다. 같은 오류는 `N회`로 합쳐진다.
   */
  import { anchor } from './anchors'
  import { feedback } from './feedback.svelte'

  interface Props {
    scope: string
    /** bottom=1b 상태줄(패널 하단), top=2a 배너(패널 상단) */
    placement?: 'top' | 'bottom'
  }
  let { scope, placement = 'bottom' }: Props = $props()

  const items = $derived(feedback.forPanel(scope))
  const item = $derived(items[0])
</script>

<div class="notice {placement}" {@attach anchor(`${scope}.panel`, 'panel')}>
  {#if item}
    <div
      class="line fb-{item.kind}"
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      {#if item.loc}<span class="loc">{item.loc}</span>{/if}
      <span class="msg"
        >{item.title}{#if item.detail}<span class="detail"> — {item.detail}</span>{/if}</span
      >
      {#if item.count > 1}
        {#key item.seq}<span class="cnt">{item.count}회</span>{/key}
      {/if}
      <span class="grow"></span>
      {#each item.actions ?? [] as a, i (a.label)}
        <button class="act" class:primary={i === 0} onclick={a.run}>{a.label}</button>
      {/each}
      {#if items.length > 1}<span class="more">외 {items.length - 1}건</span>{/if}
      <button class="x" aria-label="닫기" onclick={() => feedback.clear(item.key)}>×</button>
    </div>
  {/if}
</div>

<style>
  .notice {
    flex: none;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--fb-soft);
    font-size: 11.5px;
    color: var(--text);
    min-width: 0;
  }
  .bottom .line {
    border-top: 1px solid var(--fb-line);
  }
  .top .line {
    border-bottom: 1px solid var(--fb-line);
  }
  .loc {
    flex: none;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--fb-c);
    background: var(--bg-raised);
    border: 1px solid var(--fb-line);
    padding: 0 6px;
    border-radius: 3px;
  }
  .msg {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    color: var(--text-dim);
  }
  .cnt {
    flex: none;
    font-size: 10.5px;
    color: var(--fb-c);
    animation: shake 320ms var(--ease);
  }
  @keyframes shake {
    25% {
      transform: translateX(-2px);
    }
    75% {
      transform: translateX(2px);
    }
  }
  .grow {
    flex: 1;
  }
  .more {
    flex: none;
    color: var(--text-faint);
  }
  .act {
    flex: none;
    color: var(--text-dim);
  }
  .act:hover {
    color: var(--text);
  }
  .act.primary {
    color: var(--accent);
    font-weight: 600;
  }
  .x {
    flex: none;
    color: var(--text-faint);
    font-size: 14px;
    line-height: 1;
  }
  .x:hover {
    color: var(--text);
  }
</style>
