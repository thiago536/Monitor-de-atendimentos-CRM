import React, { useState, useMemo } from "react"
import {
    Users, TrendingUp, Star, AlertTriangle, CheckCircle2,
    User, X, Phone, Calendar, MessageSquare, ChevronRight,
    Search, Filter, ArrowUpRight, ArrowDownRight
} from "lucide-react"

// ============================================================
// 1. INTERFACES E TIPAGEM
// ============================================================

interface Atendimento {
    id: string
    id_atendente: string
    nome_cliente: string
    telefone: string
    status: string
    motivo: string | null
    created_at: string
    updated_at: string | null
    duration_minutes: number
    status_visual: "Em andamento" | "Sucesso" | "Falha" | "Transferido"
    avaliacao?: number
    origem?: 'receptivo' | 'ativo'
}

interface ClienteAgregado {
    nome: string
    telefone: string
    total: number
    somaAvaliacao: number
    qtdAvaliacao: number
    lastDate: string
    lastAgent: string
    motives: Record<string, number>
    media: string
    mediaNum: number
    topMotive: string
}

// ============================================================
// 2. COMPONENTES AUXILIARES (MODULARIZAÇÃO)
// ============================================================

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon className="h-6 w-6" />
        </div>
        <div>
            <p className="text-sm text-slate-500 font-medium">{title}</p>
            <h4 className="text-2xl font-bold text-slate-800">{value}</h4>
            {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
        </div>
    </div>
)

const RatingBadge = ({ rating }: { rating: number }) => {
    const getColor = (r: number) => {
        if (r >= 4) return "bg-emerald-50 text-emerald-700 border-emerald-100"
        if (r >= 3) return "bg-amber-50 text-amber-700 border-amber-100"
        return "bg-red-50 text-red-700 border-red-100"
    }

    return (
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-xs ${getColor(rating)}`}>
            <Star className={`h-3 w-3 ${rating >= 3 ? 'fill-current' : ''}`} />
            {rating.toFixed(1)}
        </div>
    )
}

// ============================================================
// 3. COMPONENTE PRINCIPAL
// ============================================================

export const ClientMapModal = ({
    isOpen,
    onClose,
    data,
    viewMode
}: {
    isOpen: boolean,
    onClose: () => void,
    data: Atendimento[],
    viewMode: string
}) => {
    const [searchTerm, setSearchTerm] = useState("")

    // Lógica de processamento otimizada
    const clientMapData = useMemo(() => {
        const map = new Map<string, any>();

        data.forEach(d => {
            if (!d.telefone || d.telefone.length < 8) return;
            const key = d.telefone;

            if (!map.has(key)) {
                map.set(key, {
                    nome: "Cliente",
                    telefone: d.telefone,
                    total: 0,
                    somaAvaliacao: 0,
                    qtdAvaliacao: 0,
                    lastDate: d.created_at,
                    lastAgent: d.id_atendente || "Desconhecido",
                    motives: {}
                });
            }
            const c = map.get(key)!;
            c.total++;

            // Lógica de Nome Inteligente
            const nomeAtual = d.nome_cliente;
            const nomeEhValido = nomeAtual && nomeAtual.length > 2 && !["Cliente", "Usuário", "Desconhecido"].includes(nomeAtual);

            if (nomeEhValido) {
                if (c.nome === "Cliente" || nomeAtual!.length > c.nome.length) {
                    c.nome = nomeAtual;
                }
            }

            if (new Date(d.created_at) > new Date(c.lastDate)) {
                c.lastDate = d.created_at;
                c.lastAgent = d.id_atendente || "Desconhecido";
            }
            if (d.avaliacao) {
                c.somaAvaliacao += d.avaliacao;
                c.qtdAvaliacao++;
            }

            const m = d.motivo || "Outros";
            c.motives[m] = (c.motives[m] || 0) + 1;
        });

        const lista: ClienteAgregado[] = Array.from(map.values()).map(c => {
            const topMotive = Object.entries(c.motives as Record<string, number>)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || "Geral";
            return {
                ...c,
                media: c.qtdAvaliacao > 0 ? (c.somaAvaliacao / c.qtdAvaliacao).toFixed(1) : "N/A",
                mediaNum: c.qtdAvaliacao > 0 ? (c.somaAvaliacao / c.qtdAvaliacao) : 0,
                topMotive
            }
        });

        const filtered = lista.filter(c =>
            c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.telefone.includes(searchTerm)
        );

        return {
            stats: {
                totalClientes: lista.length,
                mediaGeral: lista.filter(c => c.qtdAvaliacao > 0).reduce((acc, curr) => acc + curr.mediaNum, 0) / (lista.filter(c => c.qtdAvaliacao > 0).length || 1),
                totalContatos: lista.reduce((acc, curr) => acc + curr.total, 0)
            },
            topVolume: [...filtered].sort((a, b) => b.total - a.total).slice(0, 10),
            topAvaliacao: [...filtered].filter(c => c.qtdAvaliacao > 0).sort((a, b) => b.mediaNum - a.mediaNum).slice(0, 5),
            detratores: [...filtered].filter(c => c.qtdAvaliacao > 0 && c.mediaNum <= 2.5).sort((a, b) => a.mediaNum - b.mediaNum).slice(0, 5)
        };
    }, [data, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-white/20">

                {/* HEADER REESTRUTURADO */}
                <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                            <Users className="h-7 w-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                                Mapa de Clientes
                                <span className="ml-2 text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                    {viewMode}
                                </span>
                            </h2>
                            <p className="text-slate-500 text-sm font-medium">Inteligência de relacionamento e satisfação</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar cliente ou tel..."
                                className="pl-10 bg-slate-100 border-none focus:ring-2 ring-indigo-500 rounded-xl w-full py-2 text-sm outline-none"
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

                    {/* DASHBOARD DE RESUMO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Total de Clientes"
                            value={clientMapData.stats.totalClientes}
                            icon={Users}
                            colorClass="bg-blue-50 text-blue-600"
                            subtitle="Clientes únicos identificados"
                        />
                        <StatCard
                            title="Média de Satisfação"
                            value={clientMapData.stats.mediaGeral.toFixed(2)}
                            icon={Star}
                            colorClass="bg-amber-50 text-amber-600"
                            subtitle="Baseado em avaliações reais"
                        />
                        <StatCard
                            title="Volume de Contatos"
                            value={clientMapData.stats.totalContatos}
                            icon={MessageSquare}
                            colorClass="bg-indigo-50 text-indigo-600"
                            subtitle="Total de interações no período"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* COLUNA 1: TOP VOLUME */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-500" />
                                    Top Volume
                                </h3>
                                <span className="text-[10px] uppercase px-2 py-1 border border-slate-300 rounded-md bg-white text-slate-600">Top 10</span>
                            </div>
                            <div className="space-y-3">
                                {clientMapData.topVolume.map((c, i) => (
                                    <div key={i} className="group bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-default">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    {i + 1}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-800 text-sm truncate w-32" title={c.nome}>{c.nome}</h4>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {c.telefone}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{c.total}</span>
                                                <p className="text-[9px] text-slate-400 uppercase font-bold">Contatos</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                <span className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none text-[10px] px-2 py-0.5 rounded">
                                                    {c.topMotive}
                                                </span>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                    <User className="h-3 w-3" />
                                                    <span>Último: {c.lastAgent.split(' ')[0]}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* COLUNA 2: MELHORES AVALIADOS */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <Star className="h-5 w-5 text-amber-500" />
                                    Promotores
                                </h3>
                                <span className="text-[10px] uppercase text-emerald-600 border border-emerald-200 px-2 py-1 rounded-md bg-white">Satisfeitos</span>
                            </div>
                            <div className="space-y-3">
                                {clientMapData.topAvaliacao.length === 0 ? (
                                    <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-300">
                                        <p className="text-sm text-slate-400 italic">Nenhuma avaliação positiva</p>
                                    </div>
                                ) : clientMapData.topAvaliacao.map((c, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 text-sm truncate" title={c.nome}>{c.nome}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <RatingBadge rating={c.mediaNum} />
                                                    <span className="text-[10px] text-slate-400">({c.qtdAvaliacao} notas)</span>
                                                </div>
                                            </div>
                                            <div className="bg-emerald-50 p-1.5 rounded-lg">
                                                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-slate-300" />
                                            <span className="text-[10px] text-slate-400">Último contato: {new Date(c.lastDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* COLUNA 3: DETRATORES */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                    Atenção Crítica
                                </h3>
                                <span className="text-[10px] uppercase animate-pulse bg-red-500 text-white px-2 py-1 rounded-md font-bold">Risco</span>
                            </div>
                            <div className="space-y-3">
                                {clientMapData.detratores.length === 0 ? (
                                    <div className="bg-emerald-50 rounded-2xl p-8 text-center border border-emerald-100 flex flex-col items-center gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm">
                                            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <p className="text-sm font-bold text-emerald-700">Tudo sob controle!</p>
                                        <p className="text-[10px] text-emerald-600/70">Nenhum cliente com nota crítica no período.</p>
                                    </div>
                                ) : clientMapData.detratores.map((c, i) => (
                                    <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-red-500 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-800 text-sm truncate" title={c.nome}>{c.nome}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <RatingBadge rating={c.mediaNum} />
                                                    <span className="text-[10px] text-red-400 font-medium">Urgente</span>
                                                </div>
                                            </div>
                                            <div className="bg-red-50 p-1.5 rounded-lg">
                                                <ArrowDownRight className="h-4 w-4 text-red-600" />
                                            </div>
                                        </div>
                                        <div className="mt-3 p-2 bg-red-50/50 rounded-lg border border-red-100">
                                            <p className="text-[10px] text-red-700 font-bold flex items-center gap-1">
                                                <MessageSquare className="h-3 w-3" /> Motivo: <span className="bg-white px-1.5 py-0.5 rounded border border-red-200 text-red-700">{c.topMotive}</span>
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="px-8 py-4 bg-white border-t border-slate-200 flex justify-between items-center">
                    <p className="text-[11px] text-slate-400 font-medium italic">
                        * Dados processados em tempo real com base no histórico de atendimentos.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                        Fechar Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
