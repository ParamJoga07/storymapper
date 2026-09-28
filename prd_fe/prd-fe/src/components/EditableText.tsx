import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  multiline?: boolean
  placeholder?: string
}

// Click-to-edit text. Enter (or blur) commits, Escape cancels.
export default function EditableText({ value, onChange, className, multiline, placeholder }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (v && v !== value) onChange(v)
    else setDraft(value)
  }

  if (!editing) {
    return (
      <span
        className={`editable ${className || ''}`}
        title="Click to edit"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || <em className="placeholder">{placeholder || 'Click to edit'}</em>}
      </span>
    )
  }

  const common = {
    value: draft,
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) commit()
      if (e.key === 'Escape') {
        setDraft(value)
        setEditing(false)
      }
    },
  }

  return multiline ? (
    <textarea
      {...common}
      ref={ref as React.RefObject<HTMLTextAreaElement>}
      className={`editable-input ${className || ''}`}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
    />
  ) : (
    <input
      {...common}
      ref={ref as React.RefObject<HTMLInputElement>}
      className={`editable-input ${className || ''}`}
      onChange={(e) => setDraft(e.target.value)}
    />
  )
}
