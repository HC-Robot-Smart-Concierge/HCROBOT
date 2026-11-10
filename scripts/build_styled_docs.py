import re
import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

NAVY_HEX = "14233A"
BORDER_HEX = "D6D3CB"
GUIDE_HEX = "5F6368"
TEXT_HEX = "202124"
WHITE_HEX = "FFFFFF"
KEY_BG_HEX = "EDF2F7"

COLOR_NAVY = RGBColor(20, 35, 58)
COLOR_GUIDE = RGBColor(95, 99, 104)
COLOR_TEXT = RGBColor(32, 33, 36)
COLOR_WHITE = RGBColor(255, 255, 255)

def clean_text(text: str) -> str:
    """Clean markdown artifacts, LaTeX math symbols, and HTML entities."""
    t = text.strip()
    # Replace LaTeX escaped percent and symbols with clean Unicode
    t = t.replace(r"\%", "%")
    t = t.replace(r"$\le$", "≤").replace(r"\le", "≤")
    t = t.replace(r"$\ge$", "≥").replace(r"\ge", "≥")
    t = t.replace(r"$\rightarrow$", "→").replace(r"\rightarrow", "→")
    t = t.replace(r"$\leftrightarrow$", "↔").replace(r"\leftrightarrow", "↔")
    t = t.replace(r"\$", "$")
    # Clean $...$ wrappers
    t = re.sub(r"\$([^$]+)\$", r"\1", t)
    # Clean escape slashes
    t = t.replace(r"\_", "_")
    return t

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    """Set inner padding for a table cell (in twips/dxa: 20 dxa = 1 pt)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_cell_shading(cell, hex_color: str):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_table_borders(table, border_color: str = BORDER_HEX):
    """Set crisp, clean table borders."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def make_table_header(row, col_widths=None):
    """Format row as table header: dark navy background, white bold text."""
    trPr = row._tr.get_or_add_trPr()
    trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

    for i, cell in enumerate(row.cells):
        set_cell_shading(cell, NAVY_HEX)
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if col_widths and i < len(col_widths):
            cell.width = Cm(col_widths[i])
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            for r in p.runs:
                r.font.name = "Arial"
                r.font.size = Pt(10)
                r.font.bold = True
                r.font.color.rgb = COLOR_WHITE

def format_body_cell(cell, width_cm=None, is_example=False):
    """Format body cell typography and spacing."""
    set_cell_margins(cell, top=90, bottom=90, left=130, right=130)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
    if width_cm:
        cell.width = Cm(width_cm)
    for p in cell.paragraphs:
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        for r in p.runs:
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            if is_example:
                r.font.italic = True
                r.font.color.rgb = COLOR_GUIDE
            else:
                r.font.color.rgb = COLOR_TEXT

def render_rich_cell_text(cell, raw_text: str, is_example=False):
    """Handle Markdown formatting like bold, italic, line breaks (<br>) inside a table cell."""
    cell.text = ""  # clear default paragraph
    lines = raw_text.split("<br>")
    for idx, line in enumerate(lines):
        line = line.strip()
        p = cell.add_paragraph() if idx > 0 else cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        
        tokens = re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)", line)
        for token in tokens:
            if not token:
                continue
            if token.startswith("**") and token.endswith("**"):
                content = clean_text(token[2:-2])
                r = p.add_run(content)
                r.font.bold = True
            elif token.startswith("*") and token.endswith("*"):
                content = clean_text(token[1:-1])
                r = p.add_run(content)
                r.font.italic = True
            elif token.startswith("`") and token.endswith("`"):
                content = clean_text(token[1:-1])
                r = p.add_run(content)
                r.font.name = "Consolas"
                r.font.size = Pt(9)
            else:
                content = clean_text(token)
                r = p.add_run(content)

            r.font.name = "Arial" if not (token.startswith("`") and token.endswith("`")) else "Consolas"
            r.font.size = Pt(9.5)
            if is_example:
                r.font.italic = True
                r.font.color.rgb = COLOR_GUIDE
            else:
                r.font.color.rgb = COLOR_TEXT

def parse_markdown_table(lines):
    """Parse list of table markdown lines into list of rows (each row is list of cells)."""
    rows = []
    for line in lines:
        line = line.strip()
        if not line.startswith("|") or not line.endswith("|"):
            continue
        parts = [p.strip() for p in line[1:-1].split("|")]
        if all(re.match(r"^:?-+:?$", p) for p in parts if p):
            continue
        rows.append(parts)
    return rows

def build_docx_from_markdown(md_path: str, output_path: str):
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    doc = Document()

    for sec in doc.sections:
        sec.top_margin = Cm(2)
        sec.bottom_margin = Cm(2)
        sec.left_margin = Cm(2)
        sec.right_margin = Cm(2)
        sec.page_width = Cm(21.0)
        sec.page_height = Cm(29.7)

    PRINTABLE_WIDTH_CM = 17.0

    lines = content.split("\n")
    i = 0
    total_lines = len(lines)

    table_col_widths_presets = {
        "Project code": [5.5, 11.5],
        "Section": [3.2, 4.0, 4.8, 5.0],
        "Item": [5.5, 11.5],
        "Decision": [1.2, 3.2, 3.8, 5.2, 1.4, 2.2],
        "Risk": [1.2, 4.5, 4.5, 5.4, 1.4],
        "Gap": [1.2, 4.2, 3.0, 5.4, 1.4, 1.8],
        "Feature": [1.2, 3.4, 2.6, 5.8, 2.0, 2.0],
        "Quality attribute": [1.5, 3.5, 4.2, 3.0, 4.8],
        "Role": [2.5, 3.5, 3.8, 4.2, 3.0],
        "Workflow": [1.2, 3.0, 2.2, 2.2, 3.6, 1.4, 2.2, 1.2],
        "Preconditions and data": [1.2, 1.2, 1.4, 3.6, 4.6, 3.6, 1.4],
        "Count": [7.0, 2.5, 3.5, 4.0],
    }

    def get_col_widths(headers, num_cols):
        hdr_str = " ".join(headers)
        for key, widths in table_col_widths_presets.items():
            if key in hdr_str:
                if len(widths) == num_cols:
                    return widths
        w = PRINTABLE_WIDTH_CM / num_cols
        return [w] * num_cols

    while i < total_lines:
        line = lines[i].strip()

        if not line:
            i += 1
            continue

        if line.startswith("**SEP490") or line.startswith("SEP490"):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(clean_text(line.replace("**", "")))
            r.font.name = "Arial"
            r.font.size = Pt(10)
            r.font.bold = True
            r.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if line.startswith("# ") and "Appendix" not in line:
            title_text = line.replace("#", "").replace("**", "").strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(6)
            r = p.add_run(clean_text(title_text))
            r.font.name = "Arial"
            r.font.size = Pt(18)
            r.font.bold = True
            r.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if line.startswith("# ") and "Appendix" in line:
            title_text = line.replace("#", "").replace("**", "").strip()
            doc.add_page_break()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(6)
            r = p.add_run(clean_text(title_text))
            r.font.name = "Arial"
            r.font.size = Pt(16)
            r.font.bold = True
            r.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if line.startswith("## "):
            sec_text = line.replace("##", "").replace("**", "").strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(clean_text(sec_text))
            r.font.name = "Arial"
            r.font.size = Pt(13)
            r.font.bold = True
            r.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if line.startswith("### "):
            subsec_text = line.replace("###", "").replace("**", "").strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(clean_text(subsec_text))
            r.font.name = "Arial"
            r.font.size = Pt(11.5)
            r.font.bold = True
            r.font.color.rgb = COLOR_NAVY
            i += 1
            continue

        if line.startswith("*") and line.endswith("*") and not line.startswith("**"):
            guide_text = line[1:-1].strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            r = p.add_run(clean_text(guide_text))
            r.font.name = "Arial"
            r.font.size = Pt(9.5)
            r.font.italic = True
            r.font.color.rgb = COLOR_GUIDE
            i += 1
            continue

        if line.startswith("|") and line.endswith("|"):
            tbl_lines = []
            while i < total_lines and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1

            table_rows = parse_markdown_table(tbl_lines)
            if not table_rows:
                continue

            num_cols = max(len(r) for r in table_rows)
            headers = table_rows[0]
            widths = get_col_widths(headers, num_cols)

            table = doc.add_table(rows=len(table_rows), cols=num_cols)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            set_table_borders(table, BORDER_HEX)

            for row in table.rows:
                trPr = row._tr.get_or_add_trPr()
                trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

            is_key_value_table = ("Project code" in headers[0] and len(headers) == 2)

            for row_idx, rdata in enumerate(table_rows):
                row = table.rows[row_idx]
                if row_idx == 0 and not is_key_value_table:
                    make_table_header(row, widths)
                    for col_idx, cell_text in enumerate(rdata):
                        if col_idx < len(row.cells):
                            render_rich_cell_text(row.cells[col_idx], cell_text)
                            for p in row.cells[col_idx].paragraphs:
                                for run in p.runs:
                                    run.font.bold = True
                                    run.font.color.rgb = COLOR_WHITE
                                    run.font.size = Pt(10)
                elif is_key_value_table:
                    for col_idx, cell_text in enumerate(rdata):
                        if col_idx < len(row.cells):
                            cell = row.cells[col_idx]
                            w = widths[col_idx] if col_idx < len(widths) else None
                            if col_idx == 0:
                                set_cell_shading(cell, KEY_BG_HEX)
                            else:
                                set_cell_shading(cell, WHITE_HEX)
                            render_rich_cell_text(cell, cell_text)
                            format_body_cell(cell, w)
                            if col_idx == 0:
                                for p in cell.paragraphs:
                                    for run in p.runs:
                                        run.font.bold = True
                                        run.font.color.rgb = COLOR_NAVY
                else:
                    for col_idx, cell_text in enumerate(rdata):
                        if col_idx < len(row.cells):
                            cell = row.cells[col_idx]
                            w = widths[col_idx] if col_idx < len(widths) else None
                            render_rich_cell_text(cell, cell_text)
                            format_body_cell(cell, w)

            sp = doc.add_paragraph()
            sp.paragraph_format.space_before = Pt(0)
            sp.paragraph_format.space_after = Pt(6)
            continue

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        tokens = re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)", line)
        for token in tokens:
            if not token:
                continue
            if token.startswith("**") and token.endswith("**"):
                r = p.add_run(clean_text(token[2:-2]))
                r.font.bold = True
            elif token.startswith("*") and token.endswith("*"):
                r = p.add_run(clean_text(token[1:-1]))
                r.font.italic = True
            elif token.startswith("`") and token.endswith("`"):
                r = p.add_run(clean_text(token[1:-1]))
                r.font.name = "Consolas"
                r.font.size = Pt(9.5)
            else:
                r = p.add_run(clean_text(token))

            r.font.name = "Arial" if not (token.startswith("`") and token.endswith("`")) else "Consolas"
            r.font.size = Pt(10.5)
            r.font.color.rgb = COLOR_TEXT

        i += 1

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        doc.save(output_path)
        print(f"Successfully generated DOCX: {output_path}")
    except PermissionError:
        alt_path = output_path.replace(".docx", "_Styled.docx")
        doc.save(alt_path)
        print(f"Target file locked, saved to alternate DOCX: {alt_path}")

def build_html_preview(md_path: str, output_path: str):
    """Build a standalone HTML version matching Google Docs / Word styling with print-to-PDF support."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")
    html_parts = []

    html_parts.append("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SWP490_FA26SE905_R2_DesignBrief</title>
<style>
  @page {
    size: A4;
    margin: 2cm;
  }
  body {
    font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: #202124;
    background-color: #ffffff;
    max-width: 21cm;
    margin: 0 auto;
    padding: 2cm;
  }
  .doc-banner {
    font-size: 10pt;
    font-weight: bold;
    color: #14233a;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }
  h1 {
    font-size: 18pt;
    color: #14233a;
    margin-top: 6px;
    margin-bottom: 8px;
    font-weight: bold;
  }
  h2 {
    font-size: 13pt;
    color: #14233a;
    margin-top: 18px;
    margin-bottom: 6px;
    font-weight: bold;
    border-bottom: 1px solid #edf2f7;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 11.5pt;
    color: #14233a;
    margin-top: 12px;
    margin-bottom: 4px;
    font-weight: bold;
  }
  .guidance {
    font-size: 9.5pt;
    font-style: italic;
    color: #5f6368;
    margin-top: 2px;
    margin-bottom: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    margin-bottom: 14px;
    font-size: 9.5pt;
  }
  th {
    background-color: #14233a;
    color: #ffffff;
    font-weight: bold;
    text-align: left;
    padding: 7px 10px;
    border: 1px solid #d6d3cb;
  }
  td {
    padding: 6px 10px;
    border: 1px solid #d6d3cb;
    vertical-align: top;
    background-color: #ffffff;
  }
  .kv-table td:first-child {
    background-color: #edf2f7;
    color: #14233a;
    font-weight: bold;
    width: 35%;
  }
  code {
    font-family: Consolas, monospace;
    font-size: 9pt;
    background-color: #f1f3f4;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .page-break {
    page-break-before: always;
    margin-top: 24px;
  }
</style>
</head>
<body>
""")

    i = 0
    total_lines = len(lines)
    while i < total_lines:
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        if line.startswith("**SEP490") or line.startswith("SEP490"):
            html_parts.append(f'<div class="doc-banner">{clean_text(line.replace("**", ""))}</div>\n')
            i += 1
            continue

        if line.startswith("# ") and "Appendix" not in line:
            title_text = line.replace("#", "").replace("**", "").strip()
            html_parts.append(f'<h1>{clean_text(title_text)}</h1>\n')
            i += 1
            continue

        if line.startswith("# ") and "Appendix" in line:
            title_text = line.replace("#", "").replace("**", "").strip()
            html_parts.append(f'<div class="page-break"></div>\n<h1>{clean_text(title_text)}</h1>\n')
            i += 1
            continue

        if line.startswith("## "):
            sec_text = line.replace("##", "").replace("**", "").strip()
            html_parts.append(f'<h2>{clean_text(sec_text)}</h2>\n')
            i += 1
            continue

        if line.startswith("### "):
            subsec_text = line.replace("###", "").replace("**", "").strip()
            html_parts.append(f'<h3>{clean_text(subsec_text)}</h3>\n')
            i += 1
            continue

        if line.startswith("*") and line.endswith("*") and not line.startswith("**"):
            guide_text = line[1:-1].strip()
            html_parts.append(f'<div class="guidance">{clean_text(guide_text)}</div>\n')
            i += 1
            continue

        if line.startswith("|") and line.endswith("|"):
            tbl_lines = []
            while i < total_lines and lines[i].strip().startswith("|") and lines[i].strip().endswith("|"):
                tbl_lines.append(lines[i].strip())
                i += 1

            table_rows = parse_markdown_table(tbl_lines)
            if not table_rows:
                continue

            headers = table_rows[0]
            is_kv = ("Project code" in headers[0] and len(headers) == 2)
            table_class = "kv-table" if is_kv else ""

            html_parts.append(f'<table class="{table_class}">\n')
            for r_idx, rdata in enumerate(table_rows):
                html_parts.append("  <tr>\n")
                if r_idx == 0 and not is_kv:
                    for c in rdata:
                        html_parts.append(f"    <th>{clean_text(c)}</th>\n")
                else:
                    for c in rdata:
                        cell_html = clean_text(c).replace("<br>", "<br/>")
                        cell_html = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", cell_html)
                        cell_html = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", cell_html)
                        cell_html = re.sub(r"`([^`]+)`", r"<code>\1</code>", cell_html)
                        html_parts.append(f"    <td>{cell_html}</td>\n")
                html_parts.append("  </tr>\n")
            html_parts.append("</table>\n")
            continue

        para_text = clean_text(line)
        para_text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", para_text)
        para_text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", para_text)
        para_text = re.sub(r"`([^`]+)`", r"<code>\1</code>", para_text)
        html_parts.append(f"<p>{para_text}</p>\n")
        i += 1

    html_parts.append("""</body>
</html>""")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("".join(html_parts))
    print(f"Successfully generated HTML: {output_path}")

if __name__ == "__main__":
    src_md = r"f:\DoAn\HC-Robot\docs\SWP490_FA26SE905_R2_DesignBrief.md"
    out_docx_1 = r"f:\DoAn\HC-Robot\docs\SWP490_FA26SE905_R2_DesignBrief.docx"
    out_docx_2 = r"f:\DoAn\HC-Robot\docs\FA26SE905_Intelligent Hotel Concierge Robot_NhanDT35.docx"
    out_docx_3 = r"c:\Users\user\Downloads\SWP490_FA26SE905_R2_DesignBrief_Styled.docx"
    out_html_1 = r"f:\DoAn\HC-Robot\docs\SWP490_FA26SE905_R2_DesignBrief.html"
    out_html_2 = r"c:\Users\user\Downloads\SWP490_FA26SE905_R2_DesignBrief.html"

    build_docx_from_markdown(src_md, out_docx_1)
    build_docx_from_markdown(src_md, out_docx_2)
    build_docx_from_markdown(src_md, out_docx_3)
    build_html_preview(src_md, out_html_1)
    build_html_preview(src_md, out_html_2)
