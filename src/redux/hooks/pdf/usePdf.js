import { useDispatch, useSelector } from 'react-redux'
import { useCallback } from 'react'
import { uploadPdf, fetchPdfs, deletePdf } from '../../actions/pdf/pdfActions'

export function usePdf() {
    const dispatch = useDispatch()
    const { documents, uploading, uploadProgress, loading, error } = useSelector(
        (state) => state.pdf
    )

    const upload = useCallback(
        async (file, section = 'general') => {
            return dispatch(uploadPdf({ file, section }))
        },
        [dispatch]
    )

    const fetchAll = useCallback(
        (section = 'general') => {
            dispatch(fetchPdfs(section))
        },
        [dispatch]
    )

    const remove = useCallback(
        (id) => {
            dispatch(deletePdf(id))
        },
        [dispatch]
    )

    return { documents, uploading, uploadProgress, loading, error, upload, fetchAll, remove }
}
