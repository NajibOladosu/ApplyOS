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
        if (parentLabel && parentLabel.textContent?.trim()) {
            // Clone and remove input to get just text
            const clone = parentLabel.cloneNode(true) as HTMLElement
            const inputInClone = clone.querySelector('input, textarea, select')
            if (inputInClone) inputInClone.remove()
            return clone.textContent?.trim() || null
        }

        // 5. Look for the closest parent container that might have secondary text
        // (common in Workday/Greenhouse where label and input are in a div)
        const parentDiv = input.closest('div, [class*="form-group"], [class*="question"]')
        if (parentDiv) {
            // Check for previous element sibling or first child that isn't the input
            const textNodes = Array.from(parentDiv.querySelectorAll('span, p, h1, h2, h3, h4, h5, h6, b, strong, label'))
            for (const node of textNodes) {
                if (node.contains(input)) continue
                const text = node.textContent?.trim()
                if (text && text.length > 3) return text
            }
        }

        // 6. Look for preceding text sibling (heuristic)
        let sibling = input.previousElementSibling
        let count = 0
        while (sibling && count < 3) {
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'LABEL'].includes(sibling.tagName)) {
                if (sibling.textContent && sibling.textContent.trim().length > 3) {
                    return sibling.textContent.trim()
                }
            }
            sibling = sibling.previousElementSibling
            count++
        }

        // 7. Placeholder/Title as fallback
        const placeholder = input.getAttribute('placeholder')
        if (placeholder && placeholder.length > 5) return placeholder

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
        const text = label.toLowerCase()
        const generics = [
            'first name', 'last name', 'email', 'phone', 'address',
            'city', 'state', 'zip', 'country', 'linkedin', 'github',
            'website', 'portfolio', 'resume', 'cover letter'
        ]
        // If it starts with any of these, skip it (unless it's a longer question containing these words)
        return generics.some(g => text === g || text.startsWith(g + ' ') || text.startsWith(g + ':'))
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
