<script lang="ts">
  /** 트리거·원인 앵커에 꼬리를 붙여 띄우는 팝오버(시안 1a·2b). 스크림 없음, 바깥 클릭·Escape 로 닫힌다. */
  import { dismissable } from '../dismiss'
  import { resolve } from './anchors'
  import FeedbackBody from './FeedbackBody.svelte'
  import { feedback, type FeedbackItem } from './feedback.svelte'

  let { item }: { item: FeedbackItem } = $props()

  const GAP = 8
  const MARGIN = 8
  let pop = $state<HTMLElement>()
  let place = $state({ left: 0, top: 0, tail: 16, below: true, ready: false })

  function reposition(): void {
    if (!pop) return
    const found = item.anchorId ? resolve([item.anchorId]) : null
    if (!found) {
      // 버튼이 사라졌다 — 다른 앵커나 트레이로 옮긴다.
      feedback.reroute(item.key)
      return
    }
    const r = found.el.getBoundingClientRect()
    const w = pop.offsetWidth
    const h = pop.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 앵커가 화면 오른쪽 절반이면 오른쪽 끝을 맞춰 안쪽으로 펼친다.
    const preferred = r.left + r.width / 2 > vw / 2 ? r.right - w : r.left
    const left = Math.max(MARGIN, Math.min(preferred, vw - w - MARGIN))
    const below = r.bottom + GAP + h <= vh - MARGIN || r.top - GAP - h < MARGIN
    const top = below ? r.bottom + GAP : r.top - GAP - h
    const tail = Math.max(12, Math.min(r.left + r.width / 2 - left - 5, w - 22))
    place = { left, top, tail, below, ready: true }
  }

  $effect(() => {
    // item 교체(반복 발생)·앵커 변경 때마다 다시 잰다.
    void item.seq
    void item.anchorId
    void pop
    reposition()
    const on = () => reposition()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
  })
</script>

<div
  bind:this={pop}
  class="fb-pop fb-{item.kind}"
  class:below={place.below}
  style:left="{place.left}px"
  style:top="{place.top}px"
  style:visibility={place.ready ? 'visible' : 'hidden'}
  role={item.kind === 'error' ? 'alert' : 'status'}
  {@attach dismissable(() => feedback.dismiss(item.key), {
    ignore: () => [item.anchorId ? resolve([item.anchorId])?.el : null],
  })}
>
  <span class="tail" style:left="{place.tail}px"></span>
  <FeedbackBody {item} onClose={() => feedback.dismiss(item.key)} />
</div>

<style>
  .fb-pop {
    position: fixed;
    z-index: var(--z-feedback);
    width: min(360px, calc(100vw - 16px));
    background: var(--bg-raised);
    border: 1px solid var(--fb-line);
    border-radius: 8px;
    box-shadow: var(--shadow-pop);
    animation: rise 160ms var(--ease);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .tail {
    position: absolute;
    width: 9px;
    height: 9px;
    background: var(--bg-raised);
    border: 1px solid var(--fb-line);
    transform: rotate(45deg);
  }
  .below .tail {
    top: -5px;
    border-right: 0;
    border-bottom: 0;
  }
  .fb-pop:not(.below) .tail {
    bottom: -5px;
    border-left: 0;
    border-top: 0;
  }
</style>
