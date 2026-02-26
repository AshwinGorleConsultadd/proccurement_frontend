import { api } from "../../redux/api/apiClient"

/**
 * Fetch all budget items for export (no pagination).
 */
async function fetchExportData(section, groupByRoom, groupByPage) {
    const params = new URLSearchParams({
        group_by_room: groupByRoom || false,
        group_by_page: groupByPage || false,
    })
    const res = await api.get(`/budget/${section}/export?${params}`)
    return res.data
}

/**
 * Format a number as currency string.
 */
function fmtCurrency(val) {
    if (val == null) return ""
    return `$${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function exportToExcel(section, groupByRoom, groupByPage) {
    const xlsxModule = await import("xlsx")
    // Handle both ESM default export and namespace export
    const XLSX = xlsxModule.default || xlsxModule
    const data = await fetchExportData(section, groupByRoom, groupByPage)
    const { items, grand_total, room_totals } = data

    const rows = []
    let prevRoom = null

    for (const item of items) {
        const room = item.room_name || "Unassigned Room"

        // Insert room header when grouping by room
        if (groupByRoom && room !== prevRoom) {
            if (prevRoom && room_totals[prevRoom] != null) {
                rows.push({
                    "Spec No": "",
                    Vendor: "",
                    "Vendor Desc": "",
                    Description: "",
                    Room: `${prevRoom} — Total`,
                    Page: "",
                    Qty: "",
                    "Unit Cost": "",
                    Extended: fmtCurrency(room_totals[prevRoom]),
                    Hidden: "",
                })
            }
            rows.push({
                "Spec No": `── ${room} ──`,
                Vendor: "", "Vendor Desc": "", Description: "",
                Room: "", Page: "", Qty: "", "Unit Cost": "", Extended: "", Hidden: "",
            })
            prevRoom = room
        }

        rows.push({
            "Spec No": item.spec_no,
            Vendor: item.vendor,
            "Vendor Desc": item.vendor_description,
            Description: item.description,
            Room: item.room_name,
            Page: item.page_no,
            Qty: item.qty,
            "Unit Cost": fmtCurrency(item.unit_cost),
            Extended: fmtCurrency(item.extended),
            Hidden: item.hidden_from_total ? "Yes" : "",
        })
    }

    // Final room subtotal if grouping by room
    if (groupByRoom && prevRoom && room_totals[prevRoom] != null) {
        rows.push({
            "Spec No": "", Vendor: "", "Vendor Desc": "", Description: "",
            Room: `${prevRoom} — Total`, Page: "", Qty: "", "Unit Cost": "",
            Extended: fmtCurrency(room_totals[prevRoom]), Hidden: "",
        })
    }

    // Grand total row
    rows.push({
        "Spec No": "", Vendor: "", "Vendor Desc": "", Description: "",
        Room: "", Page: "", Qty: "", "Unit Cost": "GRAND TOTAL",
        Extended: fmtCurrency(grand_total), Hidden: "",
    })

    const ws = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    ws["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
        { wch: 16 }, { wch: 6 }, { wch: 8 }, { wch: 12 },
        { wch: 14 }, { wch: 8 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Budget")

    // Generate binary and trigger download
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `budget_${section}_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function exportToPdf(section, groupByRoom, groupByPage) {
    const jspdfModule = await import("jspdf")
    const jsPDF = jspdfModule.jsPDF || jspdfModule.default
    const autoTableModule = await import("jspdf-autotable")
    // Register the autoTable plugin on the jsPDF class
    if (typeof autoTableModule.applyPlugin === "function") {
        autoTableModule.applyPlugin(jsPDF)
    }

    const data = await fetchExportData(section, groupByRoom, groupByPage)
    const { items, grand_total, room_totals } = data

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

    // Title
    doc.setFontSize(18)
    doc.setTextColor(75, 50, 150)
    doc.text("Budget Report", 14, 18)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Section: ${section}  |  Generated: ${new Date().toLocaleDateString()}  |  Grand Total: ${fmtCurrency(grand_total)}`, 14, 25)

    // Build table body
    const head = [["Spec No", "Vendor", "Vendor Desc", "Description", "Room", "Page", "Qty", "Unit Cost", "Extended"]]
    const body = []
    let prevRoom = null

    for (const item of items) {
        const room = item.room_name || "Unassigned Room"

        if (groupByRoom && room !== prevRoom) {
            if (prevRoom && room_totals[prevRoom] != null) {
                body.push([
                    { content: `${prevRoom} — Merchandise Total`, colSpan: 8, styles: { halign: "right", fontStyle: "bolditalic", fillColor: [235, 230, 250], textColor: [75, 50, 150] } },
                    { content: fmtCurrency(room_totals[prevRoom]), styles: { halign: "right", fontStyle: "bold", fillColor: [235, 230, 250], textColor: [75, 50, 150] } },
                ])
            }
            body.push([
                { content: room, colSpan: 9, styles: { fontStyle: "bold", fillColor: [245, 242, 255], textColor: [75, 50, 150], fontSize: 10 } },
            ])
            prevRoom = room
        }

        body.push([
            item.spec_no || "",
            item.vendor || "",
            item.vendor_description || "",
            item.description || "",
            item.room_name || "",
            item.page_no != null ? String(item.page_no) : "",
            item.qty || "",
            fmtCurrency(item.unit_cost),
            {
                content: fmtCurrency(item.extended),
                styles: item.hidden_from_total
                    ? { textColor: [160, 160, 160], fontStyle: "italic" }
                    : {},
            },
        ])
    }

    // Final room subtotal
    if (groupByRoom && prevRoom && room_totals[prevRoom] != null) {
        body.push([
            { content: `${prevRoom} — Merchandise Total`, colSpan: 8, styles: { halign: "right", fontStyle: "bolditalic", fillColor: [235, 230, 250], textColor: [75, 50, 150] } },
            { content: fmtCurrency(room_totals[prevRoom]), styles: { halign: "right", fontStyle: "bold", fillColor: [235, 230, 250], textColor: [75, 50, 150] } },
        ])
    }

    // Grand total row
    body.push([
        { content: "GRAND TOTAL", colSpan: 8, styles: { halign: "right", fontStyle: "bold", fillColor: [75, 50, 150], textColor: [255, 255, 255], fontSize: 10 } },
        { content: fmtCurrency(grand_total), styles: { halign: "right", fontStyle: "bold", fillColor: [75, 50, 150], textColor: [255, 255, 255], fontSize: 10 } },
    ])

    doc.autoTable({
        startY: 30,
        head,
        body,
        theme: "grid",
        headStyles: {
            fillColor: [75, 50, 150],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
        },
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
        },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 22 },
            2: { cellWidth: 30 },
            3: { cellWidth: 40 },
            4: { cellWidth: 28 },
            5: { cellWidth: 12, halign: "center" },
            6: { cellWidth: 16 },
            7: { cellWidth: 22, halign: "right" },
            8: { cellWidth: 24, halign: "right" },
        },
        didDrawPage: () => {
            doc.setFontSize(7)
            doc.setTextColor(150)
            doc.text(
                `Page ${doc.internal.getNumberOfPages()}`,
                doc.internal.pageSize.getWidth() - 20,
                doc.internal.pageSize.getHeight() - 8
            )
        },
    })

    doc.save(`budget_${section}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
