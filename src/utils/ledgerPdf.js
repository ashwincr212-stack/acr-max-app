// src/utils/ledgerPdf.js
// Client-side PDF export for Smart Ledger using jsPDF + autoTable
// Install: npm install jspdf jspdf-autotable

const fmt = (n) => `Rs.${Math.abs(Number(n)).toLocaleString('en-IN')}`;
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

async function buildDoc(title, rows, summary, generatedFor = null) {
  // Dynamic imports keep PDF libraries out of the main mobile bundle.
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  if (typeof autoTable !== 'function') {
    throw new Error('jspdf-autotable did not expose an autoTable function');
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      // ── Header bar
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ACR MAX — Smart Ledger', 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, 14, 17);

      // ── Title
      let y = 30;
      doc.setTextColor(26, 26, 26);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, y);
      y += 5;

      if (generatedFor) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(`Account: ${generatedFor}`, 14, y);
        y += 6;
      }

      // ── Summary chips
      if (summary) {
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(14, y, pageW - 28, 16, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(`Will Receive: ${fmt(summary.totalLent)}`, 18, y + 6);
        doc.setTextColor(220, 38, 38);
        doc.text(`Will Pay: ${fmt(summary.totalBorrowed)}`, 80, y + 6);
        const net = summary.totalLent - summary.totalBorrowed;
        doc.setTextColor(net >= 0 ? 22 : 220, net >= 0 ? 163 : 38, net >= 0 ? 74 : 38);
        doc.text(`Net: ${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}`, 148, y + 6);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(`${summary.total} entries  |  Pending: ${fmt(summary.pending)}  |  Settled: ${fmt(summary.settled)}`, 18, y + 12);
        y += 22;
      }

      // ── Table
      autoTable(doc, {
        startY: y,
        head: [['#', 'Person', 'Type', 'Amount', 'Date', 'Due Date', 'Status', 'Note']],
        body: rows,
        styles: {
          fontSize: 8,
          cellPadding: 3,
          font: 'helvetica',
          textColor: [26, 26, 26],
        },
        headStyles: {
          fillColor: [124, 58, 237],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { cellWidth: 8 },
          2: { cellWidth: 18 },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 22 },
          5: { cellWidth: 22 },
          6: { cellWidth: 18 },
        },
        didParseCell(data) {
          if (data.column.index === 2) {
            data.cell.styles.textColor = data.cell.raw === 'Lent'
              ? [22, 163, 74]
              : [220, 38, 38];
          }
          if (data.column.index === 6) {
            if (data.cell.raw === 'Settled') data.cell.styles.textColor = [22, 163, 74];
            else if (data.cell.raw === 'Overdue') data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = [107, 114, 128];
          }
        },
        margin: { left: 14, right: 14 },
      });

      // ── Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text(
          `ACR MAX Smart Ledger  ·  Page ${i} of ${pageCount}`,
          pageW / 2, doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        );
      }

      return doc;
}

async function isNativePdfContext() {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch (error) {
    console.error('Unable to detect Capacitor platform for PDF export:', error);
    return false;
  }
}

async function saveNativePdf(doc, filename) {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    const dataUri = doc.output('datauristring');
    const base64Data = dataUri.split(',')[1];
    if (!base64Data) throw new Error('jsPDF did not return valid base64 PDF data');

    const safeName = filename.replace(/[^\w.-]+/g, '_');
    const saved = await Filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    return { platform: 'native', filename: safeName, uri: saved.uri };
  } catch (error) {
    console.error('Native PDF export failed:', error);
    throw error;
  }
}

async function savePdf(doc, filename) {
  if (!(await isNativePdfContext())) {
    doc.save(filename);
    return { platform: 'web', filename };
  }

  return saveNativePdf(doc, filename);
}

function entryStatus(entry) {
  if (entry.settled) return 'Settled';
  if (!entry.dueDate) return 'Active';
  const d = Math.ceil((new Date(entry.dueDate) - new Date()) / 86400000);
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Due Today';
  return `${d}d left`;
}

function entriesToRows(entries) {
  return entries.map((e, i) => [
    i + 1,
    e.person,
    e.type === 'lent' ? 'Lent' : 'Borrowed',
    fmt(e.amount),
    fmtDate(e.date),
    fmtDate(e.dueDate),
    entryStatus(e),
    e.note || '—',
  ]);
}

function buildSummary(entries) {
  const active = entries.filter(e => !e.settled);
  return {
    totalLent: active.filter(e => e.type === 'lent').reduce((s, e) => s + e.amount, 0),
    totalBorrowed: active.filter(e => e.type === 'borrowed').reduce((s, e) => s + e.amount, 0),
    pending: active.reduce((s, e) => s + e.amount, 0),
    settled: entries.filter(e => e.settled).reduce((s, e) => s + e.amount, 0),
    total: entries.length,
  };
}

/* ── Public API ── */

export async function exportAllLedger(entries) {
  const rows = entriesToRows([...entries].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)));
  const summary = buildSummary(entries);
  const doc = await buildDoc('Full Ledger Export', rows, summary);
  return savePdf(doc, `ACR_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportPersonLedger(personName, entries) {
  const personEntries = entries
    .filter(e => e.person.trim().toLowerCase() === personName.trim().toLowerCase())
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  const rows = entriesToRows(personEntries);
  const summary = buildSummary(personEntries);
  const doc = await buildDoc('Person Ledger Statement', rows, summary, personName);
  return savePdf(doc, `ACR_Ledger_${personName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportPendingLedger(entries) {
  const pending = entries
    .filter(e => !e.settled)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  const rows = entriesToRows(pending);
  const summary = buildSummary(entries);
  const doc = await buildDoc('Pending / Overdue Ledger', rows, summary);
  return savePdf(doc, `ACR_Ledger_Pending_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function shareNativeLedgerPdf(file) {
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: 'ACR MAX Ledger PDF',
      text: 'Open or share your ledger PDF.',
      url: file.uri,
      dialogTitle: 'Share ledger PDF',
    });
  } catch (error) {
    console.error('Native PDF share failed:', error);
    throw error;
  }
}
