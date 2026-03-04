/**
 * ExtractCodesPanel.jsx
 * ─────────────────────
 * A floating panel in the EditorLayout toolbar that lets users:
 *  1. Upload a floorplan image (or use the default one bundled in the app)
 *  2. Trigger AI code extraction via POST /editor/extract-codes/stream
 *  3. Watch real-time progress for each group
 *  4. Apply the returned object_name + code values to the canvas groups
 */

import { useState, useRef } from "react";

const API_BASE = "http://localhost:8000";

export default function ExtractCodesPanel({ groups, masks, onCodesExtracted }) {
    const [open, setOpen] = useState(false);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(null); // { current, total, groupId, name, code }
    const [log, setLog] = useState([]);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);

    const appendLog = (msg) => setLog((prev) => [...prev.slice(-40), msg]);

    const handleExtract = async () => {
        // Collect editor data from props
        const editorData = {
            image_width: 2638, // defaults — backend only needs groups + masks
            image_height: 2389,
            groups,
            masks,
        };

        // Get the floorplan file
        const file = fileRef.current?.files?.[0];
        if (!file) {
            setError("Please select a floorplan image first.");
            return;
        }

        setRunning(true);
        setError(null);
        setLog([]);
        setProgress({ current: 0, total: Object.keys(groups).length });

        const form = new FormData();
        form.append("editor_data", JSON.stringify(editorData));
        form.append("floorplan", file);

        try {
            const res = await fetch(`${API_BASE}/editor/extract-codes/stream`, {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                const txt = await res.text();
                throw new Error(`Server error ${res.status}: ${txt}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // keep incomplete last chunk

                for (const chunk of lines) {
                    if (!chunk.startsWith("data: ")) continue;
                    const raw = chunk.slice(6).trim();
                    if (!raw) continue;

                    try {
                        const evt = JSON.parse(raw);

                        if (evt.type === "progress") {
                            const skipped = evt.skipped ? " (skipped)" : "";
                            appendLog(
                                `[${evt.index}/${evt.total}] ${evt.group_id}: "${evt.object_name}" | ${evt.code || "—"}${skipped}`
                            );
                            setProgress({ current: evt.index, total: evt.total });
                        }

                        if (evt.type === "error") {
                            throw new Error(evt.message);
                        }

                        if (evt.type === "done") {
                            onCodesExtracted(evt.data.groups);
                            appendLog("✅ Done — all groups enriched!");
                            setProgress(null);
                        }
                    } catch (parseErr) {
                        // ignore malformed SSE lines
                    }
                }
            }
        } catch (err) {
            setError(err.message || "Extraction failed.");
            appendLog(`❌ Error: ${err.message}`);
        } finally {
            setRunning(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                title="Extract object codes with AI"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded shadow-sm border pointer-events-auto transition-colors bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                AI Extract Codes
            </button>
        );
    }

    const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <div className="pointer-events-auto bg-white border border-gray-200 rounded-xl shadow-lg w-80 p-4 space-y-3 text-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    AI Code Extraction
                </span>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
                Sends each masked object to Gemini Vision to identify its name and product code
                (e.g. CH-502, TC-508) from the floorplan labels.
            </p>

            {/* Floorplan upload */}
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Floorplan Image <span className="text-red-400">*</span>
                </label>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={running}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-indigo-50 file:text-indigo-700 file:text-xs cursor-pointer disabled:opacity-50"
                />
                <p className="text-xs text-gray-400 mt-0.5">Upload the same floorplan used when creating masks.</p>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                    ⚠️ {error}
                </div>
            )}

            {/* Progress bar */}
            {running && progress && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Processing groups...</span>
                        <span>{progress.current}/{progress.total}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Log */}
            {log.length > 0 && (
                <div className="bg-gray-50 rounded-lg border border-gray-100 p-2 h-36 overflow-y-auto font-mono text-xs text-gray-600 space-y-0.5">
                    {log.map((line, i) => (
                        <div key={i} className={line.startsWith("✅") ? "text-green-600" : line.startsWith("❌") ? "text-red-600" : ""}>
                            {line}
                        </div>
                    ))}
                </div>
            )}

            {/* Action button */}
            <button
                onClick={handleExtract}
                disabled={running}
                className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${running
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                    }`}
            >
                {running ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Extracting...
                    </span>
                ) : (
                    "▶ Start Extraction"
                )}
            </button>

            <p className="text-xs text-gray-400 text-center">
                {Object.keys(groups).length} groups · Uses Gemini Vision AI
            </p>
        </div>
    );
}
