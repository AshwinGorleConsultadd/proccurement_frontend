import { useDispatch, useSelector } from 'react-redux'
import { useCallback, useEffect, useRef } from 'react'
import {
    startProcessing,
    pollJobStatus,
    fetchJobImages,
    saveSelectedImages,
    fetchJobs,
} from '../../actions/floorplan/floorplanActions'
import {
    toggleImageSelection,
    selectAllImages,
    clearSelection,
    clearJob,
    setCurrentJob,
} from '../../slices/floorplanSlice'

export function useFloorplan() {
    const dispatch = useDispatch()
    const { jobs, currentJob, images, selectedImages, savedMetadata, loading, error } =
        useSelector((state) => state.floorplan)
    const pollRef = useRef(null)

    // Auto-poll while job is processing
    useEffect(() => {
        if (!currentJob) return
        if (currentJob.status === 'pending' || currentJob.status === 'processing') {
            clearInterval(pollRef.current)
            pollRef.current = setInterval(() => {
                dispatch(pollJobStatus(currentJob.id))
            }, 2000)
        } else {
            clearInterval(pollRef.current)
        }
        return () => clearInterval(pollRef.current)
    }, [currentJob?.id, currentJob?.status, dispatch])

    // Whenever the job flips to 'done' AND images aren't loaded yet → fetch them
    useEffect(() => {
        if (currentJob?.status === 'done') {
            dispatch(fetchJobImages(currentJob.id))
        }
    }, [currentJob?.id, currentJob?.status])   // deliberately omit images / dispatch to avoid loops

    const start = useCallback(
        (pdfId, dpi, minAreaPct) => dispatch(startProcessing({ pdfId, dpi, minAreaPct })),
        [dispatch]
    )

    const saveSelected = useCallback(
        (jobId) => {
            const selected = Object.keys(selectedImages)
            return dispatch(saveSelectedImages({ jobId, selected }))
        },
        [dispatch, selectedImages]
    )

    /** Load all jobs — set currentJob and immediately load images for the latest done job */
    const loadJobs = useCallback(async () => {
        const result = await dispatch(fetchJobs())
        const allJobs = result?.payload
        if (Array.isArray(allJobs) && allJobs.length > 0) {
            const latest = allJobs[0]   // newest first (backend orders desc)
            // Only auto-select if it's currently processing. 
            // 'done' jobs shouldn't auto-load on mount to allow a fresh start.
            if (latest?.status === 'processing') {
                dispatch(setCurrentJob(latest))
            }
        }
        return result
    }, [dispatch])

    return {
        jobs,
        currentJob,
        images,
        selectedImages,
        savedMetadata,
        loading,
        error,
        start,
        saveSelected,
        loadJobs,
        toggleSelect: (name) => dispatch(toggleImageSelection(name)),
        selectAll: () => dispatch(selectAllImages()),
        clearSel: () => dispatch(clearSelection()),
        reset: () => dispatch(clearJob()),
    }
}
