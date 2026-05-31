
import { toast } from 'sonner';

export interface LsrTableDefinition {
    id: string;
    name: string;
    columns: string[];
}

export const LsrParser = {
    /**
     * Parses the static structure of LSR tables from the configuration.
     * Return default table definitions since relying entirely on external presets
     * might leave the UI empty if not provided.
     */
    parseDefinitions(): LsrTableDefinition[] {
        const tables: LsrTableDefinition[] = [
            { id: "0", name: "Thông tin Hiện tại", columns: ["Thời gian", "Địa điểm", "Sự kiện", "Mục tiêu"] },
            { id: "1", name: "Nhân vật Gần đây", columns: ["Tên Nhân vật", "Thái độ/Trạng thái", "Hành động"] },
            { id: "2", name: "Trạng thái Bản thân", columns: ["Chỉ số/Tên", "Giá trị", "Mô tả"] },
            { id: "3", name: "Quan hệ (Relationships)", columns: ["Tên Nhân vật", "Độ thân thiết", "Chi tiết/Đánh giá"] },
            { id: "4", name: "Nhiệm vụ / Quest", columns: ["Thời gian", "Trạng thái", "Tên Quest", "Tiến độ"] },
            { id: "5", name: "Kỹ năng / Phép thuật", columns: ["Tên kỹ năng", "Cấp độ", "Sức mạnh / Mô tả"] },
            { id: "6", name: "Túi đồ (Inventory)", columns: ["Tên vật phẩm", "Số lượng", "Trạng thái/Tác dụng"] },
            { id: "7", name: "Trang bị đang mặc", columns: ["Vị trí", "Tên trang bị", "Hiệu ứng/Độ bền"] },
            { id: "8", name: "Địa điểm đã biết", columns: ["Tên Địa điểm", "Mô tả / Tiến độ khám phá"] },
            { id: "9", name: "Phe phái / Thế lực", columns: ["Tên phe phái", "Danh tiếng", "Trạng thái ngoại giao"] },
            { id: "10", name: "Timeline Sự kiện Thế giới", columns: ["Thời gian", "Ý nghĩa", "Tên sự kiện", "Chi tiết"] },
            { id: "11", name: "Tin đồn / Nhật ký", columns: ["Nguồn", "Nội dung", "Độ tin cậy"] },
            { id: "12", name: "Hiệu ứng (Buff/Debuff)", columns: ["Tên hiệu ứng", "Thời gian còn lại", "Tác dụng"] },
            { id: "13", name: "Kinh tế / Tiền tệ", columns: ["Loại tài sản", "Số lượng", "Ghi chú"] },
            { id: "14", name: "Pet / Đồng hành", columns: ["Tên", "Trạng thái", "Lòng trung thành / Vai trò"] },
            { id: "15", name: "Timeline Nhân Vật Chính", columns: ["ARC (Giai đoạn)", "Thời điểm (Ngày/Tháng/Năm)", "Tên Nhân vật - Tuổi", "Sự kiện"] }
        ];
        
        return tables;
    },

    /**
     * Parses the runtime output from AI (Text-based LSR format).
     * Format:
     * <table_stored>
     * #0 Thông tin Hiện tại|0:Năm Thương Lan 3025|1:Hang đá
     * #1 Nhân vật Gần đây|0:Lộ Na|1:0|2:Ăn uống
     * </table_stored>
     * 
     * Returns a map of TableID -> Array of Rows (objects)
     */
    parseLsrString(rawString: string): Record<string, Record<string, string>[]> {
        const result: Record<string, Record<string, string>[]> = {};
        
        if (!rawString) return result;

        // Clean up common AI artifacts that might be inside the tag
        const cleanString = rawString
            .replace(/```lsr/g, '')
            .replace(/```/g, '')
            .trim();

        const addRowToResult = (tableId: string, rowObj: Record<string, string>) => {
            if (Object.keys(rowObj).length === 0) return;
            if (!result[tableId]) result[tableId] = [];
            
            // Avoid adding identical row to the same table if parsed multiple times
            const isDuplicate = result[tableId].some(existingRow => {
                const keys = Object.keys(existingRow);
                if (keys.length !== Object.keys(rowObj).length) return false;
                return keys.every(k => existingRow[k] === rowObj[k]);
            });
            
            if (!isDuplicate) {
                result[tableId].push(rowObj);
            }
        };

        const tableDefs = LsrParser.parseDefinitions();

        // Helper to normalize strings for comparison in Vietnamese
        const normalizeStr = (s: string) => {
            return s.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/[^a-z0-9]/g, "")
                .trim();
        };

        // --- PHƯƠNG ÁN 1: ĐỊNH DẠNG LSR CHUẨN (#ID Name|0:Val...) ---
        const lines = cleanString.split('\n').map(l => l.trim()).filter(Boolean);
        let parsedStandardCount = 0;

        lines.forEach(line => {
            // Support formats like "#6 Túi đồ|0:Quả táo|1:1" or "- #6 Túi đồ|0:Táo|1:1" or "#6|0:Táo|1:1"
            const standardMatch = line.match(/(?:^|[-*\s]+)#(\d+)/);
            if (standardMatch) {
                const tableId = standardMatch[1];
                const parts = line.split('|');
                const rowObj: Record<string, string> = {};

                let hasIndices = false;
                parts.slice(1).forEach(part => {
                    if (part.match(/^\s*\d+\s*:/)) {
                        hasIndices = true;
                    }
                });

                if (hasIndices) {
                    parts.slice(1).forEach(part => {
                        const colColMatch = part.match(/^\s*(\d+)\s*:\s*([\s\S]*)$/);
                        if (colColMatch) {
                            const colIdx = colColMatch[1];
                            const colVal = colColMatch[2].trim();
                            rowObj[colIdx] = colVal;
                        }
                    });
                } else {
                    // Fallback: If AI forgot index columns (e.g., #6 Túi đồ|Quả táo|1|Hồi phục)
                    // We map sequentially based on defined index position
                    parts.slice(1).forEach((part, idx) => {
                        rowObj[idx.toString()] = part.trim();
                    });
                }

                if (Object.keys(rowObj).length > 0) {
                    addRowToResult(tableId, rowObj);
                    parsedStandardCount++;
                }
            }
        });

        if (parsedStandardCount > 0) {
            // Cap at most 10 lines for "Thông tin Hiện tại" (ID #0)
            if (result["0"] && result["0"].length > 10) {
                result["0"] = result["0"].slice(-10);
            }
            return result;
        }

        // --- PHƯƠNG ÁN 2: DỰ PHÒNG BẢNG MARKDOWN (NẾU AI QUÊN ĐỊNH DẠNG) ---
        const rawTableBlocks: string[][] = [];
        let currentBlock: string[] = [];

        lines.forEach(line => {
            if (line.startsWith('|') && line.endsWith('|')) {
                currentBlock.push(line);
            } else {
                if (currentBlock.length > 0) {
                    rawTableBlocks.push(currentBlock);
                    currentBlock = [];
                }
            }
        });
        if (currentBlock.length > 0) {
            rawTableBlocks.push(currentBlock);
        }

        rawTableBlocks.forEach(block => {
            // Must have at least header + row columns
            if (block.length < 2) return;

            // Extract headers: e.g., ["Tên vật phẩm", "Số lượng", "Tác dụng"]
            const headerLine = block[0];
            const headers = headerLine.split('|')
                .slice(1, -1)
                .map(h => h.trim());

            let startIndex = 1;
            // Skip the markdown table divider row (e.g. |---|---|)
            if (block[1] && block[1].includes('-')) {
                startIndex = 2;
            }

            // High-precision schema matching
            let bestTableId = "0";
            let bestScore = -1;

            tableDefs.forEach(def => {
                let score = 0;
                const defNorms = def.columns.map(c => normalizeStr(c));
                
                headers.forEach(h => {
                    const hNorm = normalizeStr(h);
                    if (!hNorm) return;
                    if (defNorms.includes(hNorm)) {
                        score += 3; // exact match weight
                    } else if (defNorms.some(dn => dn.includes(hNorm) || hNorm.includes(dn))) {
                        score += 1.5; // partial overlapping matching
                    }
                });

                // Also check if table name or definition is contained or matched in surrounding lines or headers
                const nameNorm = normalizeStr(def.name);
                headers.forEach(h => {
                    if (normalizeStr(h).includes(nameNorm)) {
                        score += 2;
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestTableId = def.id;
                }
            });

            // If we have a reasonable key overlap match, map row data
            if (bestScore > 1.5) {
                const matchedDef = tableDefs.find(t => t.id === bestTableId);
                const matchedCols = matchedDef ? matchedDef.columns : [];

                for (let i = startIndex; i < block.length; i++) {
                    const rowLine = block[i];
                    const cells = rowLine.split('|').slice(1, -1).map(c => c.trim());
                    if (cells.length === 0) continue;

                    const rowObj: Record<string, string> = {};
                    cells.forEach((cellVal, cellIdx) => {
                        const cellHeader = headers[cellIdx];
                        let targetColIdx = -1;
                        
                        if (cellHeader) {
                            const normCH = normalizeStr(cellHeader);
                            targetColIdx = matchedCols.findIndex(mc => normalizeStr(mc) === normCH);
                        }

                        if (targetColIdx !== -1) {
                            rowObj[targetColIdx.toString()] = cellVal;
                        } else if (cellIdx < matchedCols.length) {
                            rowObj[cellIdx.toString()] = cellVal;
                        }
                    });

                    if (Object.keys(rowObj).length > 0) {
                        addRowToResult(bestTableId, rowObj);
                    }
                }
            } else {
                // If headers do not overlap clearly, default guess by column count
                let guessedTableId = "0"; // Default to "Thông tin Hiện tại" (4 columns)
                if (headers.length === 3) guessedTableId = "2"; // Default 3-column table: "Trạng thái Bản thân"
                else if (headers.length === 4) guessedTableId = "0";

                const matchedDef = tableDefs.find(t => t.id === guessedTableId);
                const matchedColCount = matchedDef ? matchedDef.columns.length : headers.length;

                for (let i = startIndex; i < block.length; i++) {
                    const rowLine = block[i];
                    const cells = rowLine.split('|').slice(1, -1).map(c => c.trim());
                    if (cells.length === 0) continue;

                    const rowObj: Record<string, string> = {};
                    cells.forEach((cellVal, cellIdx) => {
                        if (cellIdx < matchedColCount) {
                            rowObj[cellIdx.toString()] = cellVal;
                        }
                    });

                    if (Object.keys(rowObj).length > 0) {
                        addRowToResult(guessedTableId, rowObj);
                    }
                }
            }
        });

        // Cap "Thông tin Hiện tại" (ID #0) at 10 items
        if (result["0"] && result["0"].length > 10) {
            result["0"] = result["0"].slice(-10);
        }

        return result;
    },

    /**
     * Converts the runtime data map back to the text-based LSR format for AI consumption.
     */
    stringifyLsrData(data: Record<string, Record<string, string>[]>, tables: LsrTableDefinition[]): string {
        let result = "";
        
        tables.forEach(table => {
            const rows = data[table.id] || [];
            if (rows.length === 0) return;

            rows.forEach(row => {
                // Format: #ID Name|0:Val|1:Val
                let rowStr = `#${table.id} ${table.name}|`;
                
                const colEntries = Object.entries(row)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                    .map(([idx, val]) => `${idx}:${val}`);
                
                rowStr += colEntries.join('|');
                result += rowStr + "\n";
            });
        });

        return result.trim();
    },

    /**
     * Merges new data into existing data.
     * If a row with the same key (column 0) exists, it updates it.
     * Otherwise, it adds a new row.
     */
    mergeLsrData(existing: Record<string, Record<string, string>[]>, incoming: Record<string, Record<string, string>[]>): Record<string, Record<string, string>[]> {
        const next = { ...existing };
        const tableDefs = this.parseDefinitions();

        Object.keys(incoming).forEach(tableId => {
            const existingRows = next[tableId] ? [...next[tableId]] : [];
            const incomingRows = incoming[tableId];

            const tableDef = tableDefs.find(t => t.id === tableId);
            const tableName = tableDef ? tableDef.name : `Bảng ${tableId}`;

            incomingRows.forEach(newRow => {
                const keyVal = newRow["0"]; // Column 0 is usually the ID/Name
                
                // Detect "REMOVE" value to delete the row
                const isDelete = Object.keys(newRow).some(k => {
                    if (k === "0") return false; // Don't delete just because primary key is empty/REMOVE, unless explicitly intended, but normally it's the other columns
                    const val = newRow[k];
                    return val.trim().toUpperCase() === "REMOVE";
                });

                if (isDelete && keyVal !== undefined) {
                    const existingIndex = existingRows.findIndex(r => r["0"] === keyVal);
                    if (existingIndex !== -1) {
                        existingRows.splice(existingIndex, 1);
                        toast(`🗑️ Đã xóa khỏi ${tableName}`, { description: keyVal });
                    }
                    return; // Skip adding/updating
                }

                if (keyVal === undefined) {
                    existingRows.push(newRow);
                } else {
                    const existingIndex = existingRows.findIndex(r => r["0"] === keyVal);
                    if (existingIndex !== -1) {
                        // Update existing row
                        existingRows[existingIndex] = { ...existingRows[existingIndex], ...newRow };
                        // Filter toasts for important tables
                        if (["4", "6", "12"].includes(tableId)) {
                            // Find what changed maybe? Just simple update toast
                            const updatedVal = newRow["1"] || newRow["2"] || "";
                            toast(`🔄 Cập nhật ${tableName}`, { description: `${keyVal} (${updatedVal})` });
                        }
                    } else {
                        // Add new row
                        existingRows.push(newRow);
                        if (["4", "6", "12"].includes(tableId)) {
                            let icon = "📦";
                            if (tableId === "4") icon = "⚠️";
                            if (tableId === "12") icon = "🛡️";
                            toast(`${icon} Mới trong ${tableName}`, { description: keyVal });
                        }
                    }
                }
            });

            // Giới hạn 10 dòng cho bảng "Thông tin Hiện tại" (ID #0)
            if (tableId === "0" && existingRows.length > 10) {
                next[tableId] = existingRows.slice(-10);
            } else {
                next[tableId] = existingRows;
            }
        });

        return next;
    }
};
