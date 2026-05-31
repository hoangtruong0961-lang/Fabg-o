import React, { useEffect, useState } from 'react';
import { CharacterSheet } from '../../../types';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import { dbService } from '../../../services/db/indexedDB';
import { 
    User, Calendar, Smile, BookOpen, Volume2, Sparkles, Check, Heart, HelpCircle, 
    Plus, Trash2, Tags, Info, HelpCircle as HelpIcon, Flame, ShieldAlert,
    Brain, Award, Compass, MessageSquare
} from 'lucide-react';

export interface CustomFieldDefinition {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select';
    options?: string[];
    placeholder?: string;
    description?: string;
    section?: 'identity' | 'concept' | 'psyche' | 'skills_limits' | 'meta'; // Deeper layout mapping
}

export interface CustomSchemaTemplate {
    id: string;
    name: string;
    description?: string;
    fields: CustomFieldDefinition[];
}

const DEFAULT_TEMPLATES: CustomSchemaTemplate[] = [
    {
        id: 'rpg-kiem-hiep',
        name: 'RPG Kiếm Hiệp CoT / Tu Tiên',
        description: 'Phù hợp với bối cảnh kiếm hiệp, huyền huyễn, tu chân tiên hiệp.',
        fields: [
            { id: 'tu_vi', label: 'Cấp độ Tu Vi / Cảnh Giới', type: 'select', options: ['Phàm Nhân', 'Luyện Khí Kỳ', 'Trúc Cơ Kỳ', 'Kim Đan Kỳ', 'Nguyên Anh Kỳ', 'Hóa Thần Kỳ', 'Cực Hạn Thượng Cảnh'], placeholder: 'Chọn cảnh giới tu vi...', description: 'Trình độ cảnh giới sức mạnh nội tại.', section: 'skills_limits' },
            { id: 'mon_phai', label: 'Môn Phái / Thế Lực', type: 'select', options: ['Thiếu Lâm Tự', 'Võ Đang Phái', 'Nga Mi Phái', 'Đường Môn', 'Ma Giáo', 'Nhất Đại Tán Tu'], placeholder: 'Chọn môn phái...', description: 'Nguồn gốc gốc võ học, võ hệ tâm pháp của nhân vật.', section: 'identity' },
            { id: 'linh_can', label: 'Linh Căn Nguyên Tố', type: 'text', placeholder: 'Hỏa hệ Thiên Linh Căn, Ngũ Hành tạp linh căn, v.v.', description: 'Tư chất ngũ hành, nguyên tố phong hệ bẩm sinh.', section: 'skills_limits' },
            { id: 'phap_bao', label: 'Bản Mệnh Pháp Bảo', type: 'textarea', placeholder: 'Huyền Thiết Trọng Kiếm, Thiên Ma Độc Châm v.v...', description: 'Thánh khí hoặc binh khí độc quyền hỗ trợ chiến đấu.', section: 'concept' }
        ]
    },
    {
        id: 'rpg-fantasy-status',
        name: 'RPG Fantasy Bản Thần Thoại',
        description: 'Mẫu chỉ số RPG cổ điển lớp nhân vật thần thoại phương Tây.',
        fields: [
            { id: 'job_class', label: 'Lớp Nhân Vật (Class)', type: 'select', options: ['Đấu Sĩ (Warrior)', 'Pháp Sư (Mage)', 'Sát Thủ (Rogue)', 'Trị Liệu (Cleric)', 'Cung Thủ (Ranger)'], placeholder: 'Chọn chức nghiệp...', description: 'Thiên hướng chiến thuật và phân khúc chiến đấu.', section: 'identity' },
            { id: 'stats_primary', label: 'Chỉ Số (HP / MP / ATK)', type: 'text', placeholder: 'HP: 1500 / MP: 500 / ATK: 150', description: 'Các thông số trị giá sinh mệnh thể hiện sức chiến đấu.', section: 'skills_limits' },
            { id: 'elemental_affinity', label: 'Hệ Ma Pháp tương hệ', type: 'select', options: ['Hỏa (Fire)', 'Thủy (Water)', 'Lôi (Lightning)', 'Phong (Wind)', 'Ánh Sáng (Light)', 'Bóng Tối (Dark)'], placeholder: 'Chọn nguyên tố thích ứng...', description: 'Sự tương hợp sức mạnh nguyên tố bẩm sinh.', section: 'skills_limits' },
            { id: 'passive_ability', label: 'Năng Lực Đặc Biệt (Passive)', type: 'textarea', placeholder: 'Hồi phục năng lượng trong bóng tối, giảm 20% sát thương chí mạng...', description: 'Thuộc tính bị động độc quyền bổ trợ.', section: 'meta' }
        ]
    },
    {
        id: 'cyberpunk-scifi',
        name: 'Cyberpunk & Tương Lai Giả Tưởng',
        description: 'Phù hợp bối cảnh khoa học viễn tưởng, đô thị ngầm, cấy ghép máy móc.',
        fields: [
            { id: 'cybernetics', label: 'Cấy Ghép Sinh Học (Cyberware)', type: 'textarea', placeholder: 'Mắt quét hồng ngoại v4, Hộp sọ tăng cường tốc độ phản xạ v2...', description: 'Các bộ phận nhân tạo thế hệ cơ giới tích hợp.', section: 'concept' },
            { id: 'faction', label: 'Chi Phái / Tổ Chức Đô Thị', type: 'text', placeholder: 'Thành viên Tập đoàn Arasaka, Kỹ sư thế giới ngầm, NETRUNNER...', description: 'Mối quan hệ chính trị tương lai trong đô thị siêu cấp.', section: 'identity' },
            { id: 'hacking_level', label: 'Cấp Độ Hacking (1-10)', type: 'number', placeholder: '5', description: 'Năng lực xâm nhập luồng dữ liệu ảo.', section: 'skills_limits' }
        ]
    }
];

interface CharacterSheetEditorProps {
    data: Partial<CharacterSheet>;
    onChange: (field: keyof CharacterSheet, value: any) => void;
}

const ARCHETYPES = [
    {
        id: 'Protagonist',
        label: 'Nhân vật chính (Protagonist)',
        desc: 'Trung tâm của câu chuyện, đối mặt với xung đột chủ đạo và trải qua sự trưởng thành lớn qua thử thách.'
    },
    {
        id: 'Antagonist',
        label: 'Nhân vật phản diện (Antagonist)',
        desc: 'Thế lực cản trở tinh vi hoặc trực diện, tạo dựng những chướng ngại vật buộc nhân vật chính bộc lộ tính cách.'
    },
    {
        id: 'Mentor & Ally',
        label: 'Người hướng dẫn & Đồng minh (Mentor & Ally)',
        desc: 'Đồng hành sát cánh, cung cấp tri thức, điểm tựa tinh thần hoặc công cụ quý báu trên hành trình.'
    },
    {
        id: 'Foil',
        label: 'Nhân vật đối lập (Foil)',
        desc: 'Sở hữu tính cách triệt để tương phản nhằm làm nổi bật và tôn vinh những nét đặc sắc của nhân vật chính.'
    }
];

export const CharacterSheetEditor: React.FC<CharacterSheetEditorProps> = ({ data, onChange }) => {
    const gameTime = useWorldCreationStore(state => state.gameTime);
    const [templates] = useState<CustomSchemaTemplate[]>(() => {
        const saved = dbService.getKeyValueSync('tawa_custom_schemas_v2');
        if (saved) {
            try {
                return typeof saved === "string" ? JSON.parse(saved) : saved;
            } catch (e) {
                console.error("Failed to parse custom schemas:", e);
            }
        }
        return DEFAULT_TEMPLATES;
    });

    const startingYear = gameTime?.year || 2024;
    const birthDay = data.birthDay !== undefined ? Number(data.birthDay) : 1;
    const birthMonth = data.birthMonth !== undefined ? Number(data.birthMonth) : 1;
    const birthYear = data.birthYear !== undefined ? Number(data.birthYear) : 2000;

    const computedAge = startingYear - birthYear;
    const finalAge = computedAge >= 0 ? computedAge : 0;

    useEffect(() => {
        if (String(finalAge) !== data.age) {
            onChange('age', String(finalAge));
        }
    }, [finalAge, data.age, onChange]);

    // Active schema resolution
    const activeSchemaId = data.customSchemaId || templates[0]?.id || 'none';
    const activeSchema = templates.find(t => t.id === activeSchemaId);

    const getFieldValue = (fieldLabel: string) => {
        const found = (data.customFields || []).find(f => f.label === fieldLabel);
        return found ? found.value : '';
    };

    const handleFieldChange = (fieldLabel: string, val: string) => {
        const current = data.customFields || [];
        const next = [...current];
        const idx = next.findIndex(f => f.label === fieldLabel);
        if (idx >= 0) {
            next[idx] = { ...next[idx], value: val };
        } else {
            next.push({ label: fieldLabel, value: val });
        }
        onChange('customFields', next);
    };

    // Unified renderer of custom fields for a specific section
    const renderCustomFieldsForSection = (sectionName: 'identity' | 'concept' | 'psyche' | 'skills_limits' | 'meta') => {
        if (activeSchemaId === 'none' || !activeSchema || !activeSchema.fields) return null;
        
        const matchingFields = activeSchema.fields.filter(f => (f.section || 'skills_limits') === sectionName);
        if (matchingFields.length === 0) return null;

        return (
            <>
                {matchingFields.map((field) => (
                    <div key={field.id} className="relative flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5 transition-all">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase flex items-center gap-1.5">
                                <Tags size={12} className="text-mystic-accent" />
                                <span>{field.label}</span>
                            </span>
                            {field.description && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 font-mono hover:text-mystic-accent cursor-help" title={field.description}>
                                    <HelpIcon size={12} />
                                </span>
                            )}
                        </div>

                        {field.type === 'select' ? (
                            <select
                                value={getFieldValue(field.label)}
                                onChange={(e) => handleFieldChange(field.label, e.target.value)}
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-1 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                            >
                                <option value="" className="bg-[#e6ebf4] dark:bg-[#0b1329]">-- Chưa chọn --</option>
                                {(field.options || []).map((opt, oIdx) => (
                                    <option key={oIdx} value={opt} className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{opt}</option>
                                ))}
                            </select>
                        ) : field.type === 'textarea' ? (
                            <textarea
                                value={getFieldValue(field.label)}
                                onChange={(e) => handleFieldChange(field.label, e.target.value)}
                                placeholder={field.placeholder || "Nhập thông tin..."}
                                rows={3}
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-1 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 resize-none custom-scrollbar"
                            />
                        ) : field.type === 'number' ? (
                            <input
                                type="number"
                                value={getFieldValue(field.label)}
                                onChange={(e) => handleFieldChange(field.label, e.target.value)}
                                placeholder={field.placeholder || "0"}
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-1 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                            />
                        ) : (
                            <input
                                type="text"
                                value={getFieldValue(field.label)}
                                onChange={(e) => handleFieldChange(field.label, e.target.value)}
                                placeholder={field.placeholder || "Nhập thông tin..."}
                                className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-1 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                            />
                        )}
                        {field.description && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 italic font-medium leading-normal">{field.description}</p>
                        )}
                    </div>
                ))}
            </>
        );
    };

    return (
        <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-2 custom-scrollbar pb-8">
            
            {/* Unified Active Schema Selector - Top Banner */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-4 md:p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-mystic-accent/10 border border-mystic-accent/20 rounded-xl text-mystic-accent">
                            <Tags size={18} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Sơ Đồ Thuộc Tính Cấu Trúc</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bản bọc bối cảnh thế giới tương thích cho nhân vật</p>
                        </div>
                    </div>
                    <select
                        value={activeSchemaId}
                        onChange={(e) => {
                            onChange('customSchemaId', e.target.value);
                        }}
                        className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-850 dark:text-slate-150 text-xs font-bold border border-[#cbd2df]/30 dark:border-[#142042]/15 rounded-xl px-3.5 py-2 outline-none focus:border-mystic-accent min-w-[220px] shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]"
                    >
                        <option value="none" className="bg-[#e6ebf4] dark:bg-[#0b1329]">-- Không áp dụng Sơ đồ bọc --</option>
                        {templates.map(t => (
                            <option key={t.id} value={t.id} className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-200">{t.name}</option>
                        ))}
                    </select>
                </div>
                {activeSchema && (
                    <div className="mt-3.5 pt-3.5 border-t border-[#cbd2df]/20 dark:border-[#142042]/10 outline-none flex items-start gap-2 text-slate-500 text-[11px] font-medium leading-relaxed">
                        <Info size={12} className="text-mystic-accent flex-shrink-0 mt-0.5" />
                        <span>{activeSchema.description || 'Sơ đồ bọc bối cảnh được áp dụng đồng bộ.'}</span>
                    </div>
                )}
            </div>

            {/* 1. TOÀN DIỆN: CỐT LÕI ĐỊNH DANH (Core Identity) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3.5">
                    <User size={18} className="text-mystic-accent" />
                    <div>
                        <h4 className="font-extrabold tracking-tight text-xs uppercase tracking-wider">Thông tin cốt cách & Danh Tính</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Danh tính định danh căn bản bọc nhân dạng</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tên */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tên Nhân Vật</label>
                        <input 
                            type="text"
                            value={data.name || ''}
                            onChange={(e) => onChange('name', e.target.value)}
                            placeholder="Ví dụ: Bạch Phát Ma Tôn"
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5 leading-normal">
                            Xưng danh hoặc tôn hiệu chính thức của nhân vật trong đại lục.
                        </p>
                    </div>

                    {/* Giới Tính */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Giới Tính</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Nam', 'Nữ', 'Khác'].map(g => {
                                const isSelected = data.gender === g;
                                return (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => onChange('gender', g)}
                                        className={`py-1 text-xs font-bold rounded-xl border transition-all ${
                                            isSelected
                                                ? 'bg-[#e6ebf4] dark:bg-[#0b1329] border-mystic-accent/55 text-mystic-accent font-extrabold shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]'
                                                : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-600 dark:text-slate-400 shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] hover:text-mystic-accent'
                                        }`}
                                    >
                                        {g}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                            Bản nguyên giới tính sinh học hoặc nhân dạng của nhân vật.
                        </p>
                    </div>
                </div>

                {/* Ngày Tháng Năm Sinh / Tuổi */}
                <div className="pt-4 border-t border-[#cbd2df]/20 dark:border-[#142042]/10">
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                                <Calendar size={14} className="text-mystic-accent" />
                                <span>Vận Trình Sinh Nhật & Tuổi</span>
                            </label>
                            <span className="text-[10px] text-mystic-accent font-mono font-bold bg-mystic-accent/10 px-2 py-0.5 rounded-lg border border-mystic-accent/20">
                                {finalAge} tuổi (Thế giới năm {startingYear})
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 my-2">
                            <select
                                value={birthDay}
                                onChange={(e) => onChange('birthDay', Number(e.target.value))}
                                className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/40 rounded-xl px-2 py-1 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent"
                            >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                    <option key={d} value={d} className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-250">Ngày {d}</option>
                                ))}
                            </select>

                            <select
                                value={birthMonth}
                                onChange={(e) => onChange('birthMonth', Number(e.target.value))}
                                className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/40 rounded-xl px-2 py-1 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m} className="bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-800 dark:text-slate-250">Tháng {m}</option>
                                ))}
                            </select>

                            <input
                                type="number"
                                value={birthYear}
                                onChange={(e) => onChange('birthYear', Number(e.target.value))}
                                min={0}
                                max={startingYear}
                                placeholder="Năm sinh"
                                className="w-full bg-[#cbd2df]/20 dark:bg-[#030610]/40 rounded-xl px-3 py-1 text-slate-900 dark:text-slate-100 text-xs border border-transparent outline-none focus:border-mystic-accent font-semibold"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                            Xác định cung sao can chi và độ tuổi tính từ thời điểm mốc lịch xuất hành gốc rễ.
                        </p>
                    </div>
                </div>

                {/* Sắp xếp các trường custom thuộc mục 'identity' */}
                {activeSchemaId !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {renderCustomFieldsForSection('identity')}
                    </div>
                )}
            </div>

            {/* 2. DIỆN MẠO & PHÁT ÂM (Concept & Aesthetics) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3.5">
                    <Heart size={18} className="text-rose-500" />
                    <div>
                        <h4 className="font-extrabold tracking-tight text-xs uppercase tracking-wider">Ngoại hình & Khí Chất Giọng điệu</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bên ngoài dáng dốc và cách phát ngôn hành đạo</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Ngoại hình */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Chi tiết Ngoại hình</label>
                        <textarea 
                            value={data.appearance || ''}
                            onChange={(e) => onChange('appearance', e.target.value)}
                            placeholder="Vóc dáng dốc, trang phục bọc ngoài, khí sắc tỏ tường..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-24 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Quần áo giáp phục, sẹo tích khí quang đặc biệt hiện lộ.
                        </p>
                    </div>

                    {/* Giọng điệu */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <Volume2 size={14} className="text-mystic-accent" />
                            <span>Văn Phong Thuyết Thoại (Giọng điệu)</span>
                        </label>
                        <textarea 
                            value={data.voiceAndTone || ''}
                            onChange={(e) => onChange('voiceAndTone', e.target.value)}
                            placeholder="Cách dõng dạc nhả tự ngữ điệu, trầm khàn hoặc lười nhác..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-24 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Cách xưng danh xưng hô và khẩu quyết thường thức của nhân vật.
                        </p>
                    </div>
                </div>

                {/* Custom fields for 'concept' */}
                {activeSchemaId !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {renderCustomFieldsForSection('concept')}
                    </div>
                )}
            </div>

            {/* 3. TÂM LÝ & QUÁ KHỨ (Psyche & Backstory) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3.5">
                    <Brain size={18} className="text-amber-500" />
                    <div>
                        <h4 className="font-extrabold tracking-tight text-xs uppercase tracking-wider">Tâm Lý & Gốc Rễ Quá Khứ</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Bản tính nội tâm tâm lý và vết tích quá khứ</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tính cách */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Bản Tính & Tính Cách</label>
                        <textarea 
                            value={data.personality || ''}
                            onChange={(e) => onChange('personality', e.target.value)}
                            placeholder="Ưu phiền sâu kín, phản ứng tâm lý khi lâm cảnh khốn trọng..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-24 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Nguyên khí mấu chốt cấu tử tính hành nội liễm bản nguyên.
                        </p>
                    </div>

                    {/* Tiểu sử */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Quá Khứ Lịch Sử (Tiểu Sử)</label>
                        <textarea 
                            value={data.background || ''}
                            onChange={(e) => onChange('background', e.target.value)}
                            placeholder="Xuất thân vương triều, đại đạo truy quét môn phái hoặc kỳ môn..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-24 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Tầm vết dấn bước bọc gia đạo từ thủa bình minh cơ sở.
                        </p>
                    </div>

                    {/* Biến cố định hình lý trí */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <Compass size={13} className="text-emerald-500" />
                            <span>Biến cố bước ngoặt (Defining Events)</span>
                        </label>
                        <input 
                            type="text"
                            value={data.definingEvents || ''}
                            onChange={(e) => onChange('definingEvents', e.target.value)}
                            placeholder="Sự kiện chấn động thay đổi hoàn toàn nhân sinh..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Sự kiện quyết định lý tưởng sống tốt hay ác nhân.
                        </p>
                    </div>

                    {/* Tâm trạng hiện hành */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <Smile size={13} className="text-amber-500" />
                            <span>Khí sắc tâm cảnh (Current Mood)</span>
                        </label>
                        <input 
                            type="text"
                            value={data.currentMood || ''}
                            onChange={(e) => onChange('currentMood', e.target.value)}
                            placeholder="Lạnh lùng, nhiệt huyết, chất chứa mưu đồ sâu xa..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Tâm trạng chủ đạo của nhân vật làm bối cảnh phản ứng kế.
                        </p>
                    </div>

                    {/* Thái độ đối nhân */}
                    <div className="col-span-1 md:col-span-2 flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-indigo-400" />
                            <span>Thiết lập quan hệ & Hành xử đối nhân</span>
                        </label>
                        <input 
                            type="text"
                            value={data.relationshipTags || ''}
                            onChange={(e) => onChange('relationshipTags', e.target.value)}
                            placeholder="Ví dụ: Kính trọng bực trưởng kính bối, coi khinh dẫu phàm phu..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Quét cấu tử xưng hô và hành vi cư xử chung trong hội thoại.
                        </p>
                    </div>
                </div>

                {/* Custom fields for 'psyche' */}
                {activeSchemaId !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {renderCustomFieldsForSection('psyche')}
                    </div>
                )}
            </div>

            {/* 4. NĂNG LỰC & GIỚI HẠN (Skills & Limits) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3.5">
                    <Award size={18} className="text-emerald-500" />
                    <div>
                        <h4 className="font-extrabold tracking-tight text-xs uppercase tracking-wider">Năng lực bản thể & Giới hạn</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tuyệt học võ thuật, điểm yếu phòng god mode</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Điểm mạnh */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <Flame size={13} className="text-orange-500" />
                            <span>Điểm mạnh tuyệt đối (Strengths)</span>
                        </label>
                        <textarea 
                            value={data.strengths || ''}
                            onChange={(e) => onChange('strengths', e.target.value)}
                            placeholder="Cơ sở tu vi tinh lực vạn thủa, trận pháp đệ nhất môn..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-20 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Ưu tố kĩ nghệ cốt lõi giúp áp đảo trong cốt truyện.
                        </p>
                    </div>

                    {/* Điểm yếu */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                            <ShieldAlert size={13} className="text-rose-400" />
                            <span>Điểm yếu tử môn (Weaknesses)</span>
                        </label>
                        <textarea 
                            value={data.weaknesses || ''}
                            onChange={(e) => onChange('weaknesses', e.target.value)}
                            placeholder="Kinh mạch lệch hướng, dễ phẫn nộ kích động..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500 h-20 resize-none custom-scrollbar"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Khuyết khuyết mấu chốt cấu chế kịch bản kịch tính.
                        </p>
                    </div>
                </div>

                {/* Custom fields for 'skills_limits' */}
                {activeSchemaId !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {renderCustomFieldsForSection('skills_limits')}
                    </div>
                )}
            </div>

            {/* 5. VAI TRÒ & XUNG ĐỘT (Meta & Archetype) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3.5">
                    <Sparkles size={18} className="text-mystic-accent" />
                    <div>
                        <h4 className="font-extrabold tracking-tight text-xs uppercase tracking-wider">Vai Trò Toàn Cục & Mâu Thuẫn</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Vai diễn nhân vật trong đại cuộc thế đạo</p>
                    </div>
                </div>

                {/* Archetype pick cards */}
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Vị thế gốc rễ (Archetype)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ARCHETYPES.map((role) => {
                            const isSelected = data.narrativeRole === role.id;
                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => onChange('narrativeRole', role.id)}
                                    className={`text-left p-4 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between h-28 group ${
                                        isSelected
                                            ? 'bg-[#e6ebf4] dark:bg-[#0b1329] border-mystic-accent/50 text-mystic-accent font-extrabold shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042]'
                                            : 'bg-[#e6ebf4] dark:bg-[#0b1329] border-transparent text-slate-800 dark:text-slate-350 shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] hover:text-mystic-accent'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between pointer-events-none mb-1">
                                            <span className="font-extrabold text-xs uppercase tracking-wide group-hover:text-mystic-accent transition-colors">
                                                {role.label}
                                            </span>
                                            {isSelected && (
                                                <span className="p-0.5 rounded-full bg-mystic-accent/15 text-mystic-accent">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                                            {role.desc}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Mâu thuẫn nội tâm */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Mâu thuẫn tâm lý (Contradictions)</label>
                        <input 
                            type="text"
                            value={data.contradictions || ''}
                            onChange={(e) => onChange('contradictions', e.target.value)}
                            placeholder="Ví dụ: Bề ngoài tàn nhẫn bên trong lại đại từ đại bi..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Điểm tự mâu thuẫn làm hồn cốt câu chuyện sống động.
                        </p>
                    </div>

                    {/* Phản ứng sụp đổ */}
                    <div className="flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-1">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">Phản ứng khi sụp đổ (Failure Mode)</label>
                        <input 
                            type="text"
                            value={data.failureMode || ''}
                            onChange={(e) => onChange('failureMode', e.target.value)}
                            placeholder="Tự sát bế môn, phẫn uất cuồng hành vô thần pháp..."
                            className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal pt-1.5 border-t border-[#cbd2df]/10 dark:border-[#142042]/5">
                            Cảnh giới tuyệt cùng phản kháng kích hoạt chuyển tuyến thần hồn.
                        </p>
                    </div>
                </div>

                {/* Custom fields for 'meta' */}
                {activeSchemaId !== 'none' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {renderCustomFieldsForSection('meta')}
                    </div>
                )}
            </div>

            {/* 6. THUỘC TÍNH TỰ DO HOẶC MỞ RỘNG (Freeform Attributes) */}
            <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-6 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
                <div className="flex items-center justify-between border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
                        <Tags size={15} className="text-mystic-accent" />
                        <span>Bộ Trường Tự Do & Mở Rộng Ngoài Sơ Đồ</span>
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Các thông số bọc bổ trợ độc lập bối cảnh</span>
                </div>

                {(() => {
                    const current = data.customFields || [];
                    const isArbitraryField = (fieldLabel: string) => {
                        if (activeSchemaId === 'none' || !activeSchema) return true;
                        return !activeSchema.fields.some(f => f.label.toLowerCase() === fieldLabel.toLowerCase());
                    };

                    const arbitraries = current.filter(f => isArbitraryField(f.label));

                    return arbitraries.length === 0 ? (
                        <div className="text-center py-5 border border-dashed border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-xl text-xs text-slate-500 dark:text-slate-400 font-medium">
                            Chưa khởi tạo thuộc tính tự do độc lập nào. Bấm phía dưới để nạp nhanh!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {arbitraries.map((field, arbitIdx) => {
                                const originalIdx = current.findIndex(x => x.label === field.label);
                                return (
                                    <div key={arbitIdx} className="flex gap-3 hover:border-mystic-accent/30 transition-all items-center bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/15 p-3.5 rounded-2xl shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]">
                                        <div className="flex flex-col flex-grow space-y-2">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 mb-0.5">Tên nhãn</span>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => {
                                                        const next = [...current];
                                                        next[originalIdx] = { ...next[originalIdx], label: e.target.value };
                                                        onChange('customFields', next);
                                                    }}
                                                    placeholder="VD: Độ Trung Thành"
                                                    className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-bold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                                                />
                                            </div>
                                            <div className="flex flex-col border-t border-[#cbd2df]/20 dark:border-[#142042]/10 pt-1">
                                                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 mb-0.5">Giá trị</span>
                                                <input
                                                    type="text"
                                                    value={field.value}
                                                    onChange={(e) => {
                                                        const next = [...current];
                                                        next[originalIdx] = { ...next[originalIdx], value: e.target.value };
                                                        onChange('customFields', next);
                                                    }}
                                                    placeholder="Ví dụ: 100/100, Sắt Đá..."
                                                    className="w-full bg-transparent border-none text-slate-900 dark:text-slate-100 outline-none p-0 text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = current.filter((_, i) => i !== originalIdx);
                                                onChange('customFields', next);
                                            }}
                                            className="p-2 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-xl hover:text-rose-500 text-slate-500 transition-all cursor-pointer shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042]"
                                            title="Xóa trường tự do"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                <div className="flex justify-end pt-1">
                    <button
                        type="button"
                        onClick={() => {
                            const current = data.customFields || [];
                            onChange('customFields', [...current, { label: "", value: "" }]);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#e6ebf4] dark:bg-[#0b1329] text-slate-700 dark:text-slate-200 border border-transparent hover:text-mystic-accent rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] hover:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:hover:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042]"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        <span>Thêm thuộc tính độc lập</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
