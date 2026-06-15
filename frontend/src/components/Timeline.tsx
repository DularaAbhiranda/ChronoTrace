import { useEffect, useRef, useCallback } from 'react'
import { Timeline as VisTimelineClass, DataSet } from 'vis-timeline/standalone'
import type { TimelineOptions, TimelineItem, TimelineGroup } from 'vis-timeline/standalone'
import type { NormalizedEvent } from '../types'
import { SOURCE_COLORS, SOURCE_LABELS, EVENT_TYPE_LABELS } from '../types'

interface TimelineProps {
  events: NormalizedEvent[]
  onSelectEvent: (event: NormalizedEvent | null) => void
}

const GROUP_ORDER = ['wayback', 'crt_sh', 'rdap', 'dns', 'shodan', 'virustotal', 'hibp', 'securitytrails']

export function Timeline({ events, onSelectEvent }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<InstanceType<typeof VisTimelineClass> | null>(null)
  const eventsMapRef = useRef<Map<string, NormalizedEvent>>(new Map())
  const onSelectRef = useRef(onSelectEvent)
  onSelectRef.current = onSelectEvent

  const buildTimeline = useCallback(() => {
    if (!containerRef.current) return

    const eventsMap = new Map<string, NormalizedEvent>()
    events.forEach((e) => eventsMap.set(e.id, e))
    eventsMapRef.current = eventsMap

    const presentSources = [...new Set(events.map((e) => e.source))]
    const groups: TimelineGroup[] = presentSources
      .sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
      .map((src, i) => ({
        id: src,
        content: `<span style="color:${SOURCE_COLORS[src]};font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600">${SOURCE_LABELS[src]}</span>`,
        order: i,
      }))

    const items: TimelineItem[] = events.map((e) => ({
      id: e.id,
      group: e.source,
      start: new Date(e.timestamp),
      title: `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;max-width:260px;line-height:1.5">
        <b style="color:${SOURCE_COLORS[e.source]}">${SOURCE_LABELS[e.source]}</b>
        <span style="color:#8b949e"> · ${EVENT_TYPE_LABELS[e.event_type]}</span><br>
        <span style="color:#e6edf3">${e.subject.length > 60 ? e.subject.slice(0, 60) + '…' : e.subject}</span><br>
        <span style="color:#8b949e;font-size:10px">${e.timestamp.slice(0, 10)}</span>
      </div>`,
      content: '',
      style: `background-color:${SOURCE_COLORS[e.source]}40;border-color:${SOURCE_COLORS[e.source]};border-radius:3px;`,
      type: 'box',
      editable: false,
    }))

    const options: TimelineOptions = {
      stack: false,
      showMajorLabels: true,
      showMinorLabels: true,
      orientation: { axis: 'top' },
      zoomMin: 1000 * 60 * 60 * 24,
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 30,
      tooltip: { followMouse: true, overflowMethod: 'cap' },
      groupHeightMode: 'fixed',
      height: 320,
      minHeight: 240,
      selectable: true,
      moveable: true,
      zoomable: true,
    }

    timelineRef.current?.destroy()

    const groupDS = new DataSet(groups)
    const itemDS = new DataSet(items)
    // vis-timeline's types require content: string, but HTMLElement content is valid at runtime
    const tl = new VisTimelineClass(containerRef.current, itemDS as any, groupDS, options)
    timelineRef.current = tl

    tl.on('select', (props: { items: (string | number)[] }) => {
      if (props.items.length > 0) {
        const ev = eventsMapRef.current.get(String(props.items[0]))
        onSelectRef.current(ev ?? null)
      } else {
        onSelectRef.current(null)
      }
    })

    setTimeout(() => tl.fit(), 100)
  }, [events])

  useEffect(() => {
    buildTimeline()
    return () => {
      timelineRef.current?.destroy()
      timelineRef.current = null
    }
  }, [buildTimeline])

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted font-mono text-sm">
        No events to display.
      </div>
    )
  }

  return <div ref={containerRef} className="vis-timeline-wrapper rounded-lg overflow-hidden" />
}
