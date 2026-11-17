<script lang="ts">
  /**
   * 앱 최상단에 한 번 둔다(`App.svelte`). 두 가지를 그린다.
   * - 트리거 팝오버: 항목마다 `FeedbackPopover`
   * - 좌하단 칩 트레이(시안 2c): 앵커가 남지 않은 항목. 칩을 누르면 상세가 위로 펼쳐진다.
   * 패널 상태줄은 패널이 직접 `<PanelNotice>`를 둔다.
   */
  import FeedbackBody from './FeedbackBody.svelte'
  import FeedbackPopover from './FeedbackPopover.svelte'
  import { feedback } from './feedback.svelte'
</script>

{#each feedback.popovers as item (item.key)}
  <FeedbackPopover {item} />
{/each}

{#if feedback.tray.length}
  <div class="tray">
    {#each feedback.tray as item (item.key)}
      {#if item.open}
        <div class="detail fb-{item.kind}" role={item.kind === 'error' ? 'alert' : 'status'}>
          <FeedbackBody {item} onClose={() => feedback.dismiss(item.key)} />
        </div>
      {/if}
    {/each}
    <div class="chips">
      {#each feedback.tray as item (item.key)}
        <button
          class="chip fb-{item.kind}"
          aria-expanded={item.open}
          onclick={() => feedback.toggle(item.key)}
        >
          <span class="dot"></span>
          {item.title}{item.count > 1 ? ` ×${item.count}` : ''}
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tray {
    position: fixed;
    left: 12px;
    bottom: 12px;
    z-index: var(--z-feedback);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: min(420px, calc(100vw - 24px));
    pointer-events: none;
  }
  .tray > * {
    pointer-events: auto;
  }
  .detail {
    width: 100%;
    background: var(--bg-raised);
    border: 1px solid var(--fb-line);
    border-radius: 8px;
    box-shadow: var(--shadow-pop);
    animation: rise 160ms var(--ease);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 3px 10px 3px 8px;
    background: var(--bg-raised);
    border: 1px solid var(--fb-line);
    border-radius: 12px;
    box-shadow: var(--shadow-pop);
    color: var(--fb-c);
    font-size: 11.5px;
    font-weight: 600;
  }
  .chip .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--fb-c);
  }
</style>
