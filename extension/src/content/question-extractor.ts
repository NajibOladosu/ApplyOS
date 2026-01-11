export interface ExtractedQuestion {
    text: string
    type: 'text' | 'textarea' | 'select' | 'file' | 'radio' | 'checkbox'
    required: boolean
    options?: string[]
}

export class QuestionExtractor {
    static extract(): ExtractedQuestion[] {
        const questions: ExtractedQuestion[] = []

        // Strategy 1: Look for labelled inputs
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'))

        inputs.forEach(input => {
            if (this.isHidden(input)) return

            // Skip search bars, nav elements, etc.
            if (input.closest('nav') || input.closest('header') || input.closest('footer')) return

            const label = this.findLabel(input)
            if (!label || label.length < 5) return // Ignore "Name", "Search", etc. if too short? No, "Name" is valid.
            if (this.isGenericField(label)) return // Optionally skip generic fields like "First Name" if not desired

            questions.push({
                text: label,
                type: this.getInputType(input),
                required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
                options: this.getOptions(input)
            })
        })

        // Strategy 2: Look for specific question containers (e.g. Workday/Greenhouse specific classes could be added here)

        // Deduplicate
        return this.deduplicate(questions)
    }

    private static isHidden(el: Element): boolean {
        const style = window.getComputedStyle(el)
        return style.display === 'none' || style.visibility === 'hidden' || (el as HTMLElement).offsetParent === null
    }

    private static findLabel(input: Element): string | null {
        // 1. Check for 'id' and <label for="id">
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`)
            if (label) return label.textContent?.trim() || null
        }

        // 2. Check for 'aria-label'
        const ariaLabel = input.getAttribute('aria-label')
        if (ariaLabel) return ariaLabel.trim()

        // 3. Check for specific 'aria-labelledby'
        const ariaLabelledBy = input.getAttribute('aria-labelledby')
        if (ariaLabelledBy) {
            const label = document.getElementById(ariaLabelledBy)
            if (label) return label.textContent?.trim() || null
        }

        // 4. Check for closest <label> parent
        const parentLabel = input.closest('label')
        if (parentLabel) {
            // Clone and remove input to get just text
            const clone = parentLabel.cloneNode(true) as HTMLElement
            const inputInClone = clone.querySelector('input, textarea, select')
            if (inputInClone) inputInClone.remove()
            return clone.textContent?.trim() || null
        }

        // 5. Look for preceding text sibling (heuristic)
        let sibling = input.previousElementSibling
        while (sibling) {
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'LABEL'].includes(sibling.tagName)) {
                if (sibling.textContent && sibling.textContent.trim().length > 3) {
                    return sibling.textContent.trim()
                }
            }
            sibling = sibling.previousElementSibling
            if (!sibling) break // Limit search
        }

        return null
    }

    private static getInputType(input: Element): ExtractedQuestion['type'] {
        const tagName = input.tagName.toLowerCase()
        if (tagName === 'textarea') return 'textarea'
        if (tagName === 'select') return 'select'

        const type = input.getAttribute('type')?.toLowerCase()
        if (type === 'checkbox') return 'checkbox'
        if (type === 'radio') return 'radio'
        if (type === 'file') return 'file'

        return 'text'
    }

    private static getOptions(input: Element): string[] | undefined {
        if (input.tagName.toLowerCase() === 'select') {
            return Array.from((input as HTMLSelectElement).options)
                .map(opt => opt.text.trim())
                .filter(Boolean)
        }
        return undefined
    }

    private static isGenericField(label: string): boolean {
        // We might WANT generic fields for auto-fill, but for "Questions" maybe we only want custom ones?
        // User asked for "Detect questions on an application form"
        // Usually this means "Why do you want to work here?", not "First Name".
        // But collecting everything is safer.
        return false
    }

    private static deduplicate(questions: ExtractedQuestion[]): ExtractedQuestion[] {
        const seen = new Set()
        return questions.filter(q => {
            const signature = `${q.text}-${q.type}`
            if (seen.has(signature)) return false
            seen.add(signature)
            return true
        })
    }
}
