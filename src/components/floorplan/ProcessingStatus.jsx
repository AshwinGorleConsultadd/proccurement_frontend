
import { Progress } from "../ui/progress"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export function ProcessingStatus({ job }) {
    if (!job) return null

    const isDone = job.status === "done" || job.progress >= 100
    const isError = !!job.error_msg

    return (
        <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        {isError ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        )}
                        <span className={`font-medium ${isError ? "text-destructive" : isDone ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                            {isError ? "Error" : isDone ? "Complete" : "Processing..."}
                        </span>
                    </div>
                    <span className="font-semibold tabular-nums text-primary">{job.progress}%</span>
                </div>

                <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${isError
                                ? "bg-destructive"
                                : isDone
                                    ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                                    : "bg-gradient-to-r from-violet-500 to-indigo-600"
                            }`}
                        style={{ width: `${job.progress}%` }}
                    />
                    {/* Shimmer animation while processing */}
                    {!isDone && !isError && (
                        <div
                            className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            style={{
                                animation: "shimmer 1.5s infinite",
                                left: `${job.progress - 10}%`,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Step Description */}
            {job.step && (
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                    {job.step}
                </p>
            )}

            {/* Error */}
            {job.error_msg && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                    {job.error_msg}
                </div>
            )}
        </div>
    )
}
