import { Document } from "@/types/database"

const API_Base = "https://api.ilovepdf.com/v1"

export interface EditElement {
    type: "text" | "svg" | "image"
    page: number
    coordinates?: string // "x,y"
    dimensions?: string // "w,h" for svg/image
    text_content?: string
    font_family?: string
    font_size?: number
    font_color?: string
    params?: any
}

// Helper to encode file to base64 if needed, 
// strictly for small files we might read into memory, 
// but preferred upload is FormData.

export class ILovePDFService {
    private publicKey: string
    private secretKey: string
    private token: string | null = null

    constructor() {
        this.publicKey = process.env.ILOVEPDF_PUBLIC_KEY || ""
        this.secretKey = process.env.ILOVEPDF_SECRET_KEY || ""

        if (!this.publicKey || !this.secretKey) {
            console.error("ILovePDF API Keys missing!")
        }
    }

    async getAuthToken(): Promise<string> {
        if (this.token) return this.token

        const response = await fetch(`${API_Base}/auth`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                public_key: this.publicKey,
            }),
        })

        if (!response.ok) {
            throw new Error("Failed to authenticate with iLovePDF")
        }

        const data = await response.json()
        this.token = data.token
        return data.token
    }

    async startTask(tool: string = "editpdf"): Promise<{ server: string; task: string }> {
        const token = await this.getAuthToken()

        const response = await fetch(`${API_Base}/start/${tool}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })

        if (!response.ok) {
            throw new Error(`Failed to start task: ${response.statusText}`)
        }

        return await response.json()
    }

    async uploadFile(server: string, task: string, fileUrl: string): Promise<string> {
        const token = await this.getAuthToken()

        // 1. Fetch the file content from the URL
        const fileResponse = await fetch(fileUrl)
        if (!fileResponse.ok) throw new Error("Failed to fetch source PDF")
        const blob = await fileResponse.blob()

        // 2. Create FormData
        const formData = new FormData()
        formData.append("task", task)
        formData.append("file", blob, "resume.pdf")

        const uploadResponse = await fetch(`https://${server}/v1/upload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        })

        if (!uploadResponse.ok) {
            const err = await uploadResponse.text()
            throw new Error(`Failed to upload file: ${err}`)
        }

        const data = await uploadResponse.json()
        return data.server_filename
    }

    async processEdit(server: string, task: string, serverFilename: string, elements: EditElement[]) {
        const token = await this.getAuthToken()

        const payload = {
            task,
            tool: "editpdf",
            files: [
                {
                    server_filename: serverFilename,
                    filename: "edited_resume.pdf",
                    elements: elements
                }
            ]
        }

        const response = await fetch(`https://${server}/v1/process`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`Failed to process PDF: ${err}`)
        }

        return await response.json()
    }

    async downloadFile(server: string, task: string): Promise<ArrayBuffer> {
        const token = await this.getAuthToken()

        const response = await fetch(`https://${server}/v1/download/${task}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })

        if (!response.ok) throw new Error("Failed to download processed file")

        return await response.arrayBuffer()
    }
}
