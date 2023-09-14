import { Github, FileVideo, Upload, Wand2, Sun, Moon } from 'lucide-react'
import { Separator } from "@/components/ui/separator"
import { Textarea } from '@/components/ui/textarea'
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react'
import { getFFmpeg } from '@/lib/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { finished } from 'stream'
import { api } from '@/lib/axios'

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'
const statusMessages = {
    converting: 'convertendo',
    generating: 'Transcrevendo',
    uploading: 'carregando',
    success: 'Sucesso'
}

interface VideoInputFormProps {
    onVideoUpload: (id: string) => void
}

export function VideoInputForm({ onVideoUpload }: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const promptInputRef = useRef<HTMLTextAreaElement>(null)
    const [status, setStatus] = useState<Status>('waiting')

    function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget
        if (!files) {
            return
        }
        const selected = files[0]
        setVideoFile(selected)
    }

    const previewURL = useMemo(() => {
        if (!videoFile) {
            return null
        }
        return URL.createObjectURL(videoFile)
    }, [videoFile])

    async function convertVideoToAudio(video: File) {
        const ffmpeg = await getFFmpeg()
        await ffmpeg.writeFile('input.mp4', await fetchFile(video))

        // ffmpeg.on('log', log=>{
        //     console.log(log)
        // })

        ffmpeg.on('progress', progress => {
            console.log('Convert progress: ' + Math.round(progress.progress * 1000))
        })

        await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:a',
            '-b:a',
            '20k',
            '-acodec',
            'libmp3lame',
            'output.mp3'
        ])

        const data = await ffmpeg.readFile('output.mp3')
        const audioFileBlob = new Blob([data], { type: 'audio/mp3' })
        const audioFile = new File([audioFileBlob], 'output.mp3', {
            type: 'audio/mpeg'
        })

        console.log('Convert finished')
        return audioFile
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const prompt = promptInputRef.current?.value
        if (!videoFile) return

        setStatus('converting')
        // converter video em audio
        const audioFile = await convertVideoToAudio(videoFile)
        console.log(audioFile)

        const data = new FormData()

        await data.append('file', audioFile)

        setStatus('uploading')

        console.log("data ", data)
        const response = await api.post('/videos', data)

        const videoId = response.data.video.id
        setStatus('generating')

        await api.post(`/videos/${videoId}/transcription`, {
            prompt
        })

        setStatus('success')
        onVideoUpload(videoId)
    }



    return (
        <form className="space-y-6" onSubmit={handleUploadVideo}>
            <label className="relative border  flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"
                htmlFor="video">
                {previewURL ? (
                    <video src={previewURL} controls={false} className='pointer-events-none absolute inset-0 rounded-sm  max-h-44 m-[auto]'
                    />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4 " />
                        Selecione um video
                    </>
                )}
            </label>
            <input
                type="file"
                id="video"
                accept="video/mp4"
                className="sr-only"
                onChange={handleFileSelect}
            />
            <Separator />
            <div className="space-y-2">
                <Label htmlFor="transcription_prompt">Prompt de transcrição</Label>
                <Textarea
                    disabled={status !== 'waiting'}
                    ref={promptInputRef}
                    placeholder="inclua palavras-chave mencionadas no v[ideo separadas por vírgula(,)"
                    id="transcription_prompt"
                    className="h-20 leading-relaxed resize-none" />
            </div>
            <Button
                data-success={status === 'success'}
                disabled={status !== 'waiting'}
                className="w-full data-[success=true]:bg-emerald-400">
                {status == 'waiting' ? (
                    <>
                        Carregar vídeo
                        <Upload className="w-4 h-4 ml-2" />
                    </>
                ) : (
                    statusMessages[status]
                )}
            </Button>
        </form>
    )
}