<script lang="ts">
  /** 팝오버와 트레이 상세가 공유하는 본문 — 아이콘·제목·×N·설명·안심 문구·복구 동작. */
  import type { FeedbackItem } from './feedback.svelte'

  interface Props {
    item: FeedbackItem
    /** × 와 복구 동작 실행 뒤에 불린다 */
    onClose: () => void
  }
  let { item, onClose }: Props = $props()
</script>

<div class="head">
  <span class="ic">{item.kind === 'info' ? 'i' : '!'}</span>
  <div class="txt">
    <div class="row">
      <b>{item.title}</b>
      {#if item.count > 1}
        {#key item.seq}<span class="cnt">×{item.count}</span>{/key}
      {/if}
    </div>
    {#if item.detail}<div class="detail">{item.detail}</div>{/if}
    {#if item.reassure}<div class="reassure">{item.reassure}</div>{/if}
  </div>
  <button class="x" aria-label="닫기" onclick={onClose}>×</button>
</div>
{#if item.actions?.length}
  <div class="acts">
    {#each item.actions as a, i (a.label)}
      <button
        class="act"
        class:primary={i === 0}
        onclick={() => {
          a.run()
          onClose()
        }}>{a.label}</button
      >
    {/each}
  </div>
{/if}

<style>
  .head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 10px 9px 12px;
  }
  .ic {
    flex: none;
    width: 17px;
    height: 17px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--fb-c);
    color: var(--bg-raised);
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .txt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  b {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
  }
  .cnt {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--fb-c);
    background: var(--fb-soft);
    padding: 0 6px;
    border-radius: 9px;
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
  .detail {
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text-dim);
    overflow-wrap: anywhere;
  }
  .reassure {
    font-size: 11px;
    color: var(--text-faint);
  }
  .x {
    flex: none;
    color: var(--text-faint);
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
  }
  .x:hover {
    color: var(--text);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    padding: 6px 12px 8px 39px;
    border-top: 1px solid var(--border-soft);
    font-size: 11.5px;
  }
  .act {
    color: var(--text-dim);
  }
  .act:hover {
    color: var(--text);
  }
  .act.primary {
    color: var(--accent);
    font-weight: 600;
  }
</style>
