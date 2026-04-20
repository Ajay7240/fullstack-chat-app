import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { Camera, FileText, Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [fileAttachment, setFileAttachment] = useState(null);
    const galleryInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const documentInputRef = useRef(null);
    const { sendMessage, replyTo, setReplyTo } = useChatStore();

    const readFileAsDataUrl = (file, callback) => {
        const reader = new FileReader();
        reader.onloadend = () => callback(reader.result);
        reader.readAsDataURL(file);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            toast.error("Image must be under 8MB");
            return;
        }

        readFileAsDataUrl(file, (dataUrl) => {
            setImagePreview(dataUrl);
            setFileAttachment(null);
        });
    };

    const handleDocumentChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error("Document must be under 10MB");
            return;
        }

        readFileAsDataUrl(file, (dataUrl) => {
            setFileAttachment({
                data: dataUrl,
                name: file.name,
                type: file.type,
                size: file.size,
            });
            setImagePreview(null);
        });
    };

    const clearAttachments = () => {
        setImagePreview(null);
        setFileAttachment(null);
        if (galleryInputRef.current) galleryInputRef.current.value = "";
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (documentInputRef.current) documentInputRef.current.value = "";
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview && !fileAttachment) return;

        sendMessage({
            text: text.trim(),
            image: imagePreview,
            file: fileAttachment,
            replyTo: replyTo?._id,
        });

        setText("");
        clearAttachments();
        setReplyTo(null);
    };

    return (
        <div className="p-4 w-full">
            {replyTo && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-base-300 bg-base-200 px-3 py-2">
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-base-content/60">Replying to</div>
                        <div className="truncate text-sm">{replyTo.text || replyTo.file?.name || "Photo"}</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setReplyTo(null)}>
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {(imagePreview || fileAttachment) && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative">
                        {imagePreview ? (
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                            />
                        ) : (
                            <div className="w-56 rounded-lg border border-base-300 bg-base-200 p-3 pr-8">
                                <div className="font-medium truncate">{fileAttachment.name}</div>
                                <div className="text-xs text-base-content/60">Document</div>
                            </div>
                        )}
                        <button
                            onClick={clearAttachments}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        className="w-full input input-bordered rounded-lg input-sm sm:input-md"
                        placeholder="Type a message..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={galleryInputRef}
                        onChange={handleImageChange}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        ref={cameraInputRef}
                        onChange={handleImageChange}
                    />
                    <input
                        type="file"
                        className="hidden"
                        ref={documentInputRef}
                        onChange={handleDocumentChange}
                    />

                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => galleryInputRef.current?.click()}
                        title="Gallery"
                    >
                        <Image size={20} />
                    </button>
                    <button
                        type="button"
                        className="hidden sm:flex btn btn-circle text-zinc-400"
                        onClick={() => cameraInputRef.current?.click()}
                        title="Camera"
                    >
                        <Camera size={20} />
                    </button>
                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle ${fileAttachment ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => documentInputRef.current?.click()}
                        title="Document"
                    >
                        <FileText size={20} />
                    </button>
                </div>
                <button
                    type="submit"
                    className="btn btn-sm btn-circle"
                    disabled={!text.trim() && !imagePreview && !fileAttachment}
                >
                    <Send size={22} />
                </button>
            </form>
        </div>
    );
};

export default MessageInput;
