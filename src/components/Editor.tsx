import { htmlToText } from 'html-to-text'
import $ from 'jquery'
import { useEffect, useRef } from 'react'
import { deleteTextAtCaret, insertTextAtCaret } from '../services/util'

export default function Editor({
  text,
  handleSave,
  className = '',
  placeholder = 'notes...',
  onClick = () => {},
  multiLine = false,
  focus = false
}: {
  handleSave: (data: string) => void
  text: string
  className?: string
  placeholder?: string
  onClick?: (ev: React.MouseEvent) => void
  multiLine?: boolean
  focus?: boolean
}) {
  const thisFrame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focus && thisFrame.current) {
      thisFrame.current.focus()
    }
  }, [])

  const format = (text: string) => {
    if (!text) return ''

    return text
      .replace(/<\/?span>/g, '')
      .replace(
        /^\[ \] /gm,
        '<span class="editor-incomplete" contenteditable="false">&nbsp;</span>'
      )
      .replace(
        /^\[x\] /gm,
        '<span class="editor-complete" contenteditable="false">&nbsp;</span>'
      )
      .replace(
        /^- /gm,
        '<span class="editor-bullet" contenteditable="false">&nbsp;</span>'
      )
      .replace(
        /^__/gm,
        '<span class="editor-indent" contenteditable="false">&nbsp;</span>'
      )
      .replace(
        /^(# [^\n]+)/gm,
        '<span class="editor-heading" contenteditable="false">$1</span>'
      )
      .replace(/\n\n+/g, '\n\n')
      .split('\n')
      .map(x => '<div>' + x + '</div>')
      .join('')
  }

  const unFormat = () => {
    if (!thisFrame.current) return text
    $(thisFrame.current).find('.editor-incomplete').text('[ ] ')
    $(thisFrame.current).find('.editor-complete').text('[x] ')
    $(thisFrame.current).find('.editor-bullet').text('- ')
    $(thisFrame.current).find('.editor-indent').text('__')

    const formatted = htmlToText(thisFrame.current.innerHTML, {
      wordwrap: false,
      preserveNewlines: true,
      whitespaceCharacters: '\r\n'
    })
      .replace(/\n\n\n+/g, '\n\n')
      .replace(/\n+$/g, '')
    thisFrame.current.innerHTML = format(formatted)
    return formatted
  }

  const toggleComplete = (ev: React.MouseEvent) => {
    const el = $(ev.target)
    if (el.hasClass('editor-incomplete')) {
      el.attr('class', 'editor-complete')
    } else if (el.hasClass('editor-complete')) {
      el.attr('class', 'editor-incomplete')
    }
  }

  const handleKeyDown = (ev: React.KeyboardEvent) => {
    if (!thisFrame.current) return
    switch (ev.key) {
      case 'Escape':
        $(thisFrame.current).trigger('blur')
        break
      case 'Tab':
        ev.preventDefault()
        if (ev.shiftKey) deleteTextAtCaret(4)
        else insertTextAtCaret('   ')
        break
      case 'Enter':
        if (!multiLine) {
          ev.preventDefault()
          handleSave(unFormat())
          $(thisFrame.current).trigger('blur')
        }
        break
      case 'c':
        if (ev.metaKey) return
        break
    }
  }

  return (
    <div
      ref={thisFrame}
      onClick={ev => {
        toggleComplete(ev)
        onClick(ev)
      }}
      contentEditable
      className={`min-h-[1em] min-w-[3em] whitespace-pre-wrap font-sans font-[200] outline-none ${className} cursor-text pt-[2.5px] empty:before:content-[attr(data-hold)] child:min-h-[1em]`}
      data-hold={placeholder}
      onBlur={() => !confirm && handleSave(unFormat())}
      dangerouslySetInnerHTML={{ __html: format(text) }}
      onKeyDown={handleKeyDown}></div>
  )
}
