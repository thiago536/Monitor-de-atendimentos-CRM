"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Activity, Clock, User, CheckCircle2, CalendarDays, RotateCcw, Search, X, MessageCircle, Wifi, WifiOff, Filter, TrendingUp, Users, Target, ChevronLeft, ChevronRight, AlertTriangle, Ghost, Calendar, Bell, Info, Sparkles, TrendingDown, BrainCircuit, Trophy, Flame, Zap, RefreshCw, Star, Phone, ArrowUpRight, ArrowDownRight, MessageSquare } from "lucide-react"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    BarChart,
    Bar,
    Line,
    ComposedChart,
    ReferenceLine
} from "recharts"
import { supabase } from "@/lib/supabase" // âœ… Import do singleton

// --- CONFIGURAÃ‡ÃƒO API ---
// --- CONFIGURAÇÃO API ---
const API_BASE_URL = "http://sua-api-url.com/api";

// ðŸŽ›ï¸ MASTER SWITCH
const ENABLE_GAMIFICATION = true;

const IGNORED_USERS = [
    "sistema monitor", "sistema monitor (recovery)", "desconhecido",
    "atendente desconhecido", "atendente", "usuario", "null", "undefined"
];

// âœ… FUNÃ‡ÃƒO AUXILIAR: Gera Data BR (YYYY-MM-DD) - MESMA DO BACKEND
function getDataBrasil() {
    return new Intl.DateTimeFormat('fr-CA', {
        timeZone: 'America/Sao_Paulo'
    }).format(new Date());
}

// Tipos
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
    avaliacao?: number // â­ Campo Novo
    origem?: 'receptivo' | 'ativo' // ðŸ†•
}

interface MonitorAtendente {
    id_atendente: string;
    online: boolean; // Mapeado de online_calculado
    last_seen: string;
    chats_snapshot: { telefone: string; qtd: number }[] | null;
}

interface AlertaSistema {
    id: string; tipo: 'CRITICO' | 'URGENTE' | 'ALERTA'; categoria: string;
    mensagem: string; sugestao: string; timestamp: string; resolvido: boolean;
}

interface PrevisaoHoraria {
    hora: string; volumeEsperado: number; isPico: boolean;
}

interface AnaliseIA {
    recomendacao?: { agentes: number; motivo: string; prioridade: 'alta' | 'mÃ©dia' | 'baixa' | 'fixa' };
    proximasHoras?: PrevisaoHoraria[]; tendencia?: string; mediaHistorica?: number;
    projecao7Dias?: { dia: string, dataCompleta: string, previsao: number }[];
    mock?: boolean; // Indicador de dados simulados vindo da API
}

interface JogadorRanking {
    nome: string; pontos: number; tickets: number; tma: number;
    conquistas: string[]; avatar_initials: string;
}

interface TransferenciaLog {
    id: string;
    atendente_origem: string;
    atendente_destino: string;
    telefone_cliente: string;
    nome_cliente: string | null;
    data_transferencia: string;
    motivo: string | null;
    observacao: string | null;
}

const COLORS = {
    success: "#10b981", failure: "#ef4444", warning: "#f59e0b",
    primary: "#3b82f6", neutral: "#94a3b8", prediction: "#6366f1"
}

const MOTIVE_COLORS = [
    '#3b82f6', '#6366f1', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
];

// --- EXTRACTED COMPONENTS (top-level to avoid re-mounting on each render) ---

interface MetricCardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    trend?: 'up' | 'down';
    iconColor: string;
}

function MetricCard({ icon: Icon, label, value, trend, iconColor }: MetricCardProps) {
    return (
        <div className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-xl ${iconColor} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6" />
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                )}
            </div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-extrabold text-slate-900">{value}</p>
        </div>
    )
}

interface RecommendationPanelProps {
    recomendacao?: { agentes: number; motivo: string; prioridade: 'alta' | 'média' | 'baixa' | 'fixa' }
}

function RecommendationPanel({ recomendacao }: RecommendationPanelProps) {
    if (!recomendacao) return null

    const prioridadeConfig = {
        alta: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-600' },
        média: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-600' },
        baixa: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-600' },
        fixa: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', badge: 'bg-slate-600' }
    }
    const config = prioridadeConfig[recomendacao.prioridade]

    return (
        <div className={`${config.bg} border-2 ${config.border} border-dashed rounded-2xl p-5 space-y-3`}>
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-indigo-600" />
                    Recomendação da IA
                </h4>
                <span className={`${config.badge} text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full`}>
                    {recomendacao.prioridade}
                </span>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Users className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium">Staff Sugerido</p>
                        <p className="text-2xl font-black text-slate-900">{recomendacao.agentes}</p>
                    </div>
                </div>
                <div className={`${config.text} text-xs font-medium leading-relaxed bg-white/60 p-3 rounded-lg flex items-start gap-2`}>
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{recomendacao.motivo}</span>
                </div>
            </div>
        </div>
    )
}

export default function DashboardAdministrativaPage() {
    const [data, setData] = useState<Atendimento[]>([])
    const [monitorData, setMonitorData] = useState<MonitorAtendente[]>([])
    const [activeAlerts, setActiveAlerts] = useState<AlertaSistema[]>([])

    // States de IA/PrevisÃ£o
    const [predictionData, setPredictionData] = useState<AnaliseIA | null>(null)
    const [weeklyPrediction, setWeeklyPrediction] = useState<AnaliseIA | null>(null)
    const [showPredictionModal, setShowPredictionModal] = useState(false)

    // States de GamificaÃ§Ã£o
    const [showGamingModal, setShowGamingModal] = useState(false)
    const [rankingData, setRankingData] = useState<JogadorRanking[]>([])
    const [rankingLoading, setRankingLoading] = useState(false)

    const [currentTime, setCurrentTime] = useState(new Date())
    const [loading, setLoading] = useState(true)

    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0])
    const [viewMode, setViewMode] = useState<"DiÃ¡rio" | "Mensal">("DiÃ¡rio")

    const [showModal, setShowModal] = useState(false)
    const [showClientModal, setShowClientModal] = useState(false)
    const [clientSearchTerm, setClientSearchTerm] = useState("")
    const [showAlertsPanel, setShowAlertsPanel] = useState(false)
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [transferenciasData, setTransferenciasData] = useState<TransferenciaLog[]>([])
    const itemsPerPage = 7

    const calculateDuration = (startStr: string, endStr?: string | null) => {
        const start = new Date(startStr); const end = endStr ? new Date(endStr) : new Date();
        return Math.floor((end.getTime() - start.getTime()) / 60000);
    }

    const fetchAlerts = useCallback(async () => {
        try {
            const duasHorasAtras = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('alertas_sistema').select('*').eq('resolvido', false)
                .gte('timestamp', duasHorasAtras).order('timestamp', { ascending: false });
            if (!error && data) setActiveAlerts(data as AlertaSistema[]);
        } catch (e) { console.error("Erro alertas:", e); }
    }, [])

    // âœ… MONITORAMENTO DIRETO DO SUPABASE (v0.dev nÃ£o acessa localhost)
    const fetchMonitor = useCallback(async () => {
        try {
            const { data: monitorDb, error } = await supabase
                .from('monitor_atendentes')
                .select('*')
                .order('last_seen', { ascending: false });

            if (error) throw error;

            if (monitorDb) {
                const processedMonitor = monitorDb
                    .filter((m: any) => {
                        const nome = m.id_atendente?.toLowerCase().trim() || "";
                        if (nome.length < 3) return false;
                        return !IGNORED_USERS.some(ignored => nome === ignored || nome.includes(ignored));
                    })
                    .map((m: any) => ({
                        id_atendente: m.id_atendente,
                        last_seen: m.last_seen,
                        online: m.online, // âœ… USA VALOR DIRETO DO BANCO (classe CSS do elemento)
                        chats_snapshot: m.chats_snapshot || []
                    }));

                console.log(`ðŸ”„ Monitor atualizado: ${processedMonitor.length} atendentes, ${processedMonitor.filter(a => a.online).length} online`);
                setMonitorData(processedMonitor);
            }
        } catch (e) {
            console.error("âŒ Erro ao buscar monitor do Supabase:", e);
        }
    }, [])

    // âœ… IA PREDICT - BUSCA DIRETO DO SUPABASE (CompatÃ­vel com Vercel)
    const fetchPrediction = useCallback(async (tipo: 'horario' | 'semanal') => {
        try {
            const dataHoje = getDataBrasil();
            const { data: supData, error } = await supabase
                .from('previsao_demanda')
                .select('*')
                .eq('tipo', tipo)
                .eq('data_referencia', dataHoje)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (supData && supData[0] && supData[0].payload) {
                if (tipo === 'horario') {
                    setPredictionData(supData[0].payload);
                } else {
                    setWeeklyPrediction(supData[0].payload);
                }
                console.log(`âœ… PrevisÃ£o ${tipo} carregada do Supabase`);
            } else {
                console.warn(`âš ï¸ Nenhuma previsÃ£o ${tipo} disponÃ­vel no Supabase para ${dataHoje}`);
            }
        } catch (e) {
            console.error(`âŒ Erro ao buscar previsÃ£o ${tipo} do Supabase:`, e);
        }
    }, [])

    // âœ… GAMIFICAÃ‡ÃƒO - BUSCA DIRETO DO SUPABASE
    const fetchRanking = useCallback(async (forceUpdate = false) => {
        if (!ENABLE_GAMIFICATION) return;
        setRankingLoading(true);
        try {
            const periodoSupabase = viewMode === 'DiÃ¡rio' ? 'hoje' : 'mes';
            const dataHoje = getDataBrasil();

            const { data: supData, error } = await supabase
                .from('ranking_gamificacao')
                .select('*')
                .eq('periodo', periodoSupabase)
                .eq('data_referencia', dataHoje)
                .order('pontos', { ascending: false });

            if (error) throw error;

            if (supData) {
                setRankingData(supData.map((r: any) => ({
                    nome: r.agente_id,
                    pontos: r.pontos,
                    tickets: r.tickets,
                    tma: Number(r.tma_medio),
                    conquistas: typeof r.conquistas === 'string' ? JSON.parse(r.conquistas) : (Array.isArray(r.conquistas) ? r.conquistas : []),
                    avatar_initials: r.agente_id.substring(0, 2).toUpperCase()
                })));
                console.log(`âœ… Ranking ${periodoSupabase} carregado (${supData.length} agentes)`);
            }
        } catch (e) {
            console.error("âŒ Erro ao buscar ranking do Supabase:", e);
        } finally {
            setRankingLoading(false);
        }
    }, [viewMode])

    // âœ… TRANSFERÃŠNCIAS - BUSCA LOGS DO DIA
    const fetchTransferencias = useCallback(async () => {
        try {
            const dataHoje = getDataBrasil();

            const { data, error } = await supabase
                .from('transferencias_log')
                .select('*')
                .gte('data_transferencia', `${dataHoje}T00:00:00`)
                .lte('data_transferencia', `${dataHoje}T23:59:59`)
                .order('data_transferencia', { ascending: false })
                .limit(20);

            if (error) throw error;

            if (data) {
                setTransferenciasData(data as TransferenciaLog[]);
                console.log(`âœ… TransferÃªncias carregadas (${data.length} registros)`);
            }
        } catch (e) {
            console.error("âŒ Erro ao buscar transferÃªncias:", e);
        }
    }, [])


    // Busca dados de chamados (Mantido Supabase para tickets, pois o prompt foca em Monitor/IA)
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            let query = supabase.from("atendimentos").select("*").order("created_at", { ascending: false })
            if (viewMode === "DiÃ¡rio") query = query.gte("created_at", `${dateFilter}T00:00:00`).lte("created_at", `${dateFilter}T23:59:59`)
            else {
                const [year, month] = dateFilter.split("-")
                const startDate = `${year}-${month}-01T00:00:00`
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
                const endDate = `${year}-${month}-${lastDay}T23:59:59`
                query = query.gte("created_at", startDate).lte("created_at", endDate)
            }
            const { data: dbData } = await query
            if (dbData) {
                const processedData = dbData
                    // âœ… CORREÃ‡ÃƒO: Removido filtro que bloqueava atendimentos ativos
                    // Agora atendimentos com origem='ativo' E origem='receptivo' aparecem no dashboard
                    .map((item) => {
                        let statusVisual: Atendimento["status_visual"] = "Em andamento"
                        const s = item.status?.toLowerCase() || ""
                        if (s.includes("transferido")) statusVisual = "Transferido"
                        else if (s.includes("sem sucesso") || s.includes("falha") || s.includes("nÃ£o")) statusVisual = "Falha"
                        else if (s.includes("sucesso") || s.includes("resolvido")) statusVisual = "Sucesso"
                        return {
                            ...item,
                            status_visual: statusVisual,
                            duration_minutes: calculateDuration(item.created_at, statusVisual === "Em andamento" ? undefined : (item.updated_at || new Date().toISOString()))
                        }
                    })

                setData(processedData as Atendimento[])
            }

            // Se for hoje e diÃ¡rio, atualiza monitor
            const hoje = new Date().toISOString().split("T")[0]
            if (dateFilter === hoje && viewMode === "DiÃ¡rio") {
                await fetchMonitor();
            }

        } catch (error) { console.error("Erro dados:", error) } finally { setLoading(false) }
    }, [viewMode, dateFilter])

    useEffect(() => {
        fetchData()
        fetchAlerts()
        fetchPrediction('horario')
        fetchRanking()
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000)
        const hoje = new Date().toISOString().split("T")[0]
        const isLive = dateFilter === hoje && viewMode === "DiÃ¡rio"
        let ticketsInterval: ReturnType<typeof setInterval> | null = null
        let monitorInterval: ReturnType<typeof setInterval> | null = null
        let alertsInterval: ReturnType<typeof setInterval> | null = null
        let rankingInterval: ReturnType<typeof setInterval> | null = null

        if (isLive) {
            // Monitor: 10s (crÃ­tico para status ao vivo)
            monitorInterval = setInterval(() => fetchMonitor(), 10000)
            // Tickets: 30s (menos volÃ¡til que o monitor)
            ticketsInterval = setInterval(() => fetchData(), 30000)
            alertsInterval = setInterval(() => { fetchAlerts(); fetchPrediction('horario'); }, 60000)
            rankingInterval = setInterval(() => fetchRanking(), 300000)
        }
        return () => {
            clearInterval(clockInterval);
            if (ticketsInterval) clearInterval(ticketsInterval);
            if (monitorInterval) clearInterval(monitorInterval);
            if (alertsInterval) clearInterval(alertsInterval)
            if (rankingInterval) clearInterval(rankingInterval)
        }
    }, [dateFilter, viewMode, fetchData, fetchAlerts, fetchPrediction, fetchRanking, fetchMonitor])

    useEffect(() => { setCurrentPage(1) }, [selectedAgentId, searchTerm])

    useEffect(() => {
        if (showPredictionModal && !weeklyPrediction) {
            fetchPrediction('semanal');
        }
    }, [showPredictionModal, weeklyPrediction, fetchPrediction]);

    // Ajustado para estrutura do chats_snapshot vindo da API
    const getUnreadMessages = (ticketTelefone: string, atendenteNome: string) => {
        const monitor = monitorData.find(m => m.id_atendente?.toLowerCase().trim() === atendenteNome?.toLowerCase().trim())
        if (!monitor || !monitor.chats_snapshot) return 0

        const cleanTelTicket = ticketTelefone ? ticketTelefone.replace(/\D/g, '') : ""
        if (!cleanTelTicket) return 0

        const chat = monitor.chats_snapshot.find((c: any) => {
            const cleanTelSnapshot = c.telefone ? c.telefone.replace(/\D/g, '') : ""
            return cleanTelSnapshot.includes(cleanTelTicket) || cleanTelTicket.includes(cleanTelSnapshot)
        })
        return chat ? chat.qtd : 0
    }

    const isAgentOnline = (atendenteNome: string) => {
        const monitor = monitorData.find(m => m.id_atendente?.toLowerCase().trim() === atendenteNome?.toLowerCase().trim())
        return monitor ? monitor.online : false
    }

    const activeTickets = data.filter((d) => d.status_visual === "Em andamento")
    const completedToday = data.filter((d) => d.status_visual !== "Em andamento")
    const successCount = data.filter((d) => d.status_visual === "Sucesso").length
    const failureCount = data.filter((d) => d.status_visual === "Falha").length
    const transferredCount = data.filter((d) => d.status_visual === "Transferido").length
    const totalProductive = successCount + failureCount
    const avgResolutionTime = completedToday.length > 0 ? Math.round(completedToday.reduce((acc, t) => acc + t.duration_minutes, 0) / completedToday.length) : 0

    const volumeChartData = useMemo(() => {
        if (viewMode === "DiÃ¡rio") {
            const START_HOUR = 8; const END_HOUR = 18;
            const chartData = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                const hour = START_HOUR + i
                return { label: `${hour}:00`, real: 0, sortKey: hour, previsto: null as number | null }
            })
            data.forEach(t => {
                const h = new Date(t.created_at).getHours()
                const bucket = chartData.find(b => b.sortKey === h)
                if (bucket) bucket.real++
            })
            const isToday = dateFilter === new Date().toISOString().split("T")[0]
            if (isToday && predictionData && predictionData.proximasHoras) {
                predictionData.proximasHoras.forEach(p => {
                    const h = parseInt(p.hora.split(':')[0])
                    const bucket = chartData.find(b => b.sortKey === h)
                    const currentH = new Date().getHours()
                    if (bucket && h >= currentH) {
                        bucket.previsto = p.volumeEsperado
                        if (h === currentH && bucket.real === 0) bucket.real = 0;
                    }
                })
            }
            return chartData
        } else {
            const [year, month] = dateFilter.split("-").map(Number)
            const daysInMonth = new Date(year, month, 0).getDate()
            const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                return {
                    label: `${day}`,
                    fullDate: dateStr,
                    count: 0,
                    success: 0,
                    failure: 0,
                    transferred: 0,
                    not_informed: 0,
                    sortKey: day
                }
            })
            data.forEach(t => {
                const d = new Date(t.created_at).getDate()
                const bucket = dailyData.find(b => b.sortKey === d)
                if (bucket) {
                    bucket.count++
                    if (t.status_visual === "Sucesso") bucket.success++
                    else if (t.status_visual === "Falha") bucket.failure++
                    else if (t.status_visual === "Transferido") bucket.transferred++
                    else bucket.not_informed++
                }
            })
            return dailyData
        }
    }, [data, viewMode, dateFilter, predictionData])

    const uniqueAgents = Array.from(new Set(data.map((d) => d.id_atendente || "Desconhecido"))).filter(agent => !IGNORED_USERS.some(ignored => agent.toLowerCase().includes(ignored)))
    const agentStats = uniqueAgents.map((agent) => {
        const tickets = data.filter((t) => t.id_atendente === agent)
        const success = tickets.filter((t) => t.status_visual === "Sucesso").length
        const productiveTotal = success + tickets.filter((t) => t.status_visual === "Falha").length
        const rate = productiveTotal > 0 ? (success / productiveTotal) * 100 : 0
        return { name: agent, rate, total: productiveTotal, initials: agent.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() }
    }).filter(a => a.total > 0).sort((a, b) => b.total - a.total)

    const motivesData = useMemo(() => {
        const counts: Record<string, number> = {}
        data.forEach(d => { const motivo = d.motivo || "NÃ£o Informado"; counts[motivo] = (counts[motivo] || 0) + 1 })
        return Object.entries(counts).map(([name, value], index) => ({ name, value, color: MOTIVE_COLORS[index % MOTIVE_COLORS.length] })).sort((a, b) => b.value - a.value)
    }, [data])

    const warRoomData = useMemo(() => {
        const filteredData = selectedAgentId ? data.filter(d => d.id_atendente === selectedAgentId) : data.filter(d => !IGNORED_USERS.some(ignored => d.id_atendente?.toLowerCase().includes(ignored)))
        const searchFiltered = filteredData.filter(d => (d.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase())) || (d.telefone?.includes(searchTerm)) || (d.motivo?.toLowerCase().includes(searchTerm.toLowerCase())))
        const wrTotal = filteredData.length
        const wrSuccess = filteredData.filter(d => d.status_visual === "Sucesso").length
        const wrRate = wrTotal > 0 ? Math.round((wrSuccess / wrTotal) * 100) : 0
        const wrCompleted = filteredData.filter(d => d.status_visual !== "Em andamento")
        const wrTma = wrCompleted.length > 0 ? Math.round(wrCompleted.reduce((acc, t) => acc + t.duration_minutes, 0) / wrCompleted.length) : 0
        let wrChart = []
        if (viewMode === "DiÃ¡rio") {
            const START_HOUR = 8; const END_HOUR = 18
            wrChart = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => { const hour = START_HOUR + i; return { label: `${hour}:00`, count: 0, sortKey: hour, efficiency: 0, successCount: 0 } })
            filteredData.forEach(t => {
                const h = new Date(t.created_at).getHours();
                const bucket = wrChart.find(b => b.sortKey === h);
                if (bucket) {
                    bucket.count++;
                    if (t.status_visual === "Sucesso") bucket.successCount++;
                }
            })
            // Calcula eficiÃªncia
            wrChart.forEach(b => {
                b.efficiency = b.count > 0 ? Math.round((b.successCount / b.count) * 100) : 0;
            });
        } else {
            const [year, month] = dateFilter.split("-").map(Number); const daysInMonth = new Date(year, month, 0).getDate()
            wrChart = Array.from({ length: daysInMonth }, (_, i) => { const day = i + 1; return { label: `${day}`, count: 0, sortKey: day, efficiency: 0, successCount: 0 } })
            filteredData.forEach(t => {
                const d = new Date(t.created_at).getDate();
                const bucket = wrChart.find(b => b.sortKey === d);
                if (bucket) {
                    bucket.count++;
                    if (t.status_visual === "Sucesso") bucket.successCount++;
                }
            })
            // Calcula eficiÃªncia
            wrChart.forEach(b => {
                b.efficiency = b.count > 0 ? Math.round((b.successCount / b.count) * 100) : 0;
            });
        }
        const wrMotivesCount: Record<string, number> = {}
        filteredData.forEach(d => { const m = d.motivo || "Sem motivo"; wrMotivesCount[m] = (wrMotivesCount[m] || 0) + 1 })
        const wrMotives = Object.entries(wrMotivesCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)

        // âœ… TOP CLIENTES
        const clientsMap = new Map<string, { name: string, count: number, lastSeen: string }>();
        filteredData.forEach(d => {
            const key = d.telefone || d.nome_cliente || "Desconhecido";
            if (!clientsMap.has(key)) clientsMap.set(key, { name: d.nome_cliente || "Sem nome", count: 0, lastSeen: d.created_at });
            const client = clientsMap.get(key)!;
            client.count++;
            if (new Date(d.created_at) > new Date(client.lastSeen)) client.lastSeen = d.created_at;
        });
        const topClients = Array.from(clientsMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const totalPages = Math.ceil(searchFiltered.length / itemsPerPage)
        const startIndex = (currentPage - 1) * itemsPerPage
        const endIndex = startIndex + itemsPerPage
        const paginatedList = searchFiltered.slice(startIndex, endIndex)

        return { list: paginatedList, fullListLength: searchFiltered.length, totalPages, total: wrTotal, successRate: wrRate, tma: wrTma, chart: wrChart, motives: wrMotives, topClients }
    }, [data, selectedAgentId, searchTerm, currentPage, viewMode, dateFilter])

    // ðŸ§  MAPA DE CLIENTES (AgregaÃ§Ã£o Local Melhorada)
    const clientMapData = useMemo(() => {
        const map = new Map<string, {
            nome: string,
            telefone: string,
            total: number,
            somaAvaliacao: number,
            qtdAvaliacao: number,
            lastDate: string,
            lastAgent: string,
            motives: Record<string, number>
        }>();

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

            // ðŸ§  LÃ³gica de Nome Inteligente: Prefere nomes reais e longos
            const nomeAtual = d.nome_cliente;
            const nomeEhValido = nomeAtual && nomeAtual.length > 2 && !["Cliente", "UsuÃ¡rio", "Desconhecido"].includes(nomeAtual);

            if (nomeEhValido) {
                if (c.nome === "Cliente") c.nome = nomeAtual; // Sai do genÃ©rico
                else if (nomeAtual!.length > c.nome.length) c.nome = nomeAtual!; // Prefere o mais completo
            }

            if (new Date(d.created_at) > new Date(c.lastDate)) {
                c.lastDate = d.created_at;
                c.lastAgent = d.id_atendente || "Desconhecido";
            }
            if (d.avaliacao) {
                c.somaAvaliacao += d.avaliacao;
                c.qtdAvaliacao++;
            }

            // Motivos
            const m = d.motivo || "Outros";
            c.motives[m] = (c.motives[m] || 0) + 1;
        });

        const lista = Array.from(map.values()).map(c => {
            const topMotive = Object.entries(c.motives).sort((a, b) => b[1] - a[1])[0]?.[0] || "Geral";
            return {
                ...c,
                media: c.qtdAvaliacao > 0 ? (c.somaAvaliacao / c.qtdAvaliacao).toFixed(1) : "N/A",
                mediaNum: c.qtdAvaliacao > 0 ? (c.somaAvaliacao / c.qtdAvaliacao) : 0,
                topMotive
            }
        });

        // ðŸ” Aplicar filtro de busca
        const filtered = lista.filter(c =>
            c.nome.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
            c.telefone.includes(clientSearchTerm)
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
    }, [data, clientSearchTerm]);

    const isToday = dateFilter === new Date().toISOString().split("T")[0] && viewMode === "DiÃ¡rio"

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 lg:p-6 font-sans text-slate-900 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Monitor de OperaÃ§Ãµes</h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isToday ? (
                            <>
                                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>
                                <p className="text-sm text-slate-500 font-medium">Ao Vivo â€¢ Heartbeat Ativo</p>
                            </>
                        ) : (<><span className="relative flex h-2.5 w-2.5"><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400"></span></span><p className="text-sm text-slate-500 font-medium">HistÃ³rico â€¢ {viewMode} â€¢ {viewMode === "Mensal" ? "EvoluÃ§Ã£o do MÃªs" : "Arquivo do Dia"}</p></>)}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    {ENABLE_GAMIFICATION && (
                        <button onClick={() => { fetchRanking(true); setShowGamingModal(true); }} className="bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 p-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 group" title="Ver Ranking">
                            <Trophy className="h-5 w-5 group-hover:scale-110 transition-transform text-amber-600" />
                            <span className="font-bold text-xs hidden md:inline">Ranking</span>
                        </button>
                    )}
                    <button onClick={() => setShowClientModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wide group" title="Mapa de Clientes">
                        <Users className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        <span className="hidden md:inline">Clientes</span>
                    </button>
                    <button onClick={() => { fetchPrediction('semanal'); setShowPredictionModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wide" title="Ver PrevisÃ£o"><Sparkles className="h-4 w-4" /><span className="hidden md:inline">IA Predict</span></button>
                    <div className="relative">
                        <button aria-label="Ver alertas do sistema" onClick={() => setShowAlertsPanel(!showAlertsPanel)} className={`relative p-2.5 rounded-xl border transition-all ${activeAlerts.length > 0 ? 'bg-white border-red-200 text-red-600 hover:bg-red-50 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 shadow-sm'}`}>
                            <Bell className={`h-5 w-5 ${activeAlerts.length > 0 ? 'animate-pulse' : ''}`} />
                            {activeAlerts.length > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-slate-50">{activeAlerts.length}</span>}
                        </button>
                        {showAlertsPanel && (
                            <div className="absolute right-0 top-12 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas Inteligentes</h3>
                                    <button onClick={() => setShowAlertsPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                                    {activeAlerts.length === 0 ? (
                                        <div className="p-6 text-center text-slate-400 flex flex-col items-center"><CheckCircle2 className="h-8 w-8 mb-2 opacity-20" /><p className="text-xs">Nenhum alerta ativo. OperaÃ§Ã£o normal.</p></div>
                                    ) : (
                                        activeAlerts.map((alert) => (
                                            <div key={alert.id} className={`p-3 rounded-lg border text-left ${alert.tipo === 'CRITICO' ? 'bg-red-50 border-red-100' : alert.tipo === 'URGENTE' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${alert.tipo === 'CRITICO' ? 'bg-red-200 text-red-800' : alert.tipo === 'URGENTE' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>{alert.categoria}</span>
                                                    <span className="text-[10px] text-slate-400">{new Date(alert.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800 leading-tight mb-1">{alert.mensagem}</p>
                                                <p className="text-xs text-slate-600 flex items-start gap-1"><Info className="h-3 w-3 mt-0.5 shrink-0" /> {alert.sugestao}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Controles de Data... (Mantido layout padrÃ£o) */}
                    <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <button onClick={() => setViewMode("DiÃ¡rio")} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "DiÃ¡rio" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>Dia</button>
                        <button onClick={() => setViewMode("Mensal")} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === "Mensal" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>MÃªs</button>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                        {viewMode === "DiÃ¡rio" ? <CalendarDays className="h-4 w-4 text-slate-400 ml-1" /> : <Calendar className="h-4 w-4 text-slate-400 ml-1" />}
                        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="text-sm font-medium text-slate-700 outline-none bg-transparent cursor-pointer" />
                    </div>
                    {!isToday && (<button onClick={() => { setDateFilter(new Date().toISOString().split("T")[0]); setViewMode("DiÃ¡rio") }} className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"><RotateCcw className="h-3 w-3" /> Hoje</button>)}
                    <div className="hidden md:block text-right ml-2"><div className="text-xl font-mono font-bold text-slate-800">{currentTime.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}</div></div>
                </div>
            </div>

            {isToday && (
                <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Wifi className="h-4 w-4" /> Radar de Equipe (Tempo Real)</h3>
                        {predictionData && predictionData.recomendacao && (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${predictionData.recomendacao.prioridade === 'alta' ? 'bg-red-100 text-red-700 border-red-200 animate-pulse' : predictionData.recomendacao.prioridade === 'fixa' ? 'bg-blue-100 text-blue-700 border-blue-200' : predictionData.recomendacao.prioridade === 'mÃ©dia' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                <BrainCircuit className="h-3 w-3" />
                                {predictionData.recomendacao.prioridade === 'fixa' ? predictionData.recomendacao.motivo : `Staff Sugerido: ${predictionData.recomendacao.agentes || 0} agentes`}
                                {/* âœ… AVISO DE MOCK - VerificaÃ§Ã£o segura */}
                                {(predictionData as any)?.mock && <span className="ml-2 text-[10px] opacity-70">(Simulado)</span>}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {monitorData.length === 0 ? (<span className="text-sm text-slate-400 italic">Nenhum atendente detectado ainda...</span>) : (monitorData.map(m => (
                            <div key={m.id_atendente} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${m.online ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <span className={`relative flex h-2.5 w-2.5`}>{m.online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}<span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${m.online ? 'bg-emerald-500' : 'bg-slate-400'}`}></span></span>
                                <span className={`text-sm font-bold ${m.online ? 'text-emerald-700' : 'text-slate-500'}`}>{m.id_atendente}</span>
                                {!m.online && <WifiOff className="h-3 w-3 text-slate-400" />}
                            </div>
                        )))}
                    </div>
                </div>
            )}

            {/* RESTO DO DASHBOARD - MANTIDO IGUAL (Cards, Tabelas, GrÃ¡ficos) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <Card className="border-slate-200 shadow-sm bg-white h-full">
                        <CardHeader className="pb-2 border-b border-slate-100"><CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Produtividade</CardTitle></CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {agentStats.map((agent) => (<div key={agent.name} className="group"><div className="flex items-center justify-between mb-1"><div className="flex items-center gap-2"><Avatar className="h-8 w-8 bg-slate-100 border border-slate-200"><AvatarFallback className="text-xs font-bold text-slate-600">{agent.initials}</AvatarFallback></Avatar><div><p className="text-sm font-semibold text-slate-800">{agent.name}</p><p className="text-xs text-slate-400">{agent.total} atendimentos</p></div></div><span className="text-sm font-bold text-slate-700">{agent.rate.toFixed(0)}%</span></div><Progress value={agent.rate} className="h-1.5" /></div>))}
                            {agentStats.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Sem dados de produtividade.</p>}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-6 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <Card className="border-slate-200 shadow-sm bg-white"><CardContent className="p-4 flex flex-col items-center justify-center"><p className="text-xs font-medium text-slate-400 uppercase">Total</p><p className="text-2xl font-bold text-slate-900 mt-1">{totalProductive}</p></CardContent></Card>
                        <Card className="border-slate-200 shadow-sm bg-white"><CardContent className="p-4 flex flex-col items-center justify-center"><p className="text-xs font-medium text-slate-400 uppercase">T.M.A</p><p className="text-2xl font-bold text-slate-900 mt-1">{avgResolutionTime}m</p></CardContent></Card>
                        <Card className={`${isToday ? "bg-blue-50 border-blue-100" : "bg-white border-slate-200"} shadow-sm`}><CardContent className="p-4 flex flex-col items-center justify-center"><p className={`text-xs font-medium uppercase ${isToday ? "text-blue-600" : "text-slate-400"}`}>{isToday ? "Em Andamento" : "Transferidos"}</p><p className={`text-2xl font-bold mt-1 ${isToday ? "text-blue-700 animate-pulse" : "text-slate-900"}`}>{isToday ? activeTickets.length : transferredCount}</p></CardContent></Card>
                    </div>
                    <div className="space-y-3">
                        <div className="space-y-3">
                            {viewMode === "Mensal" ? (
                                <Card className="border-slate-200 shadow-sm bg-white h-full relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                                    <CardHeader className="pb-2 border-b border-slate-100">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                                <div>
                                                    <CardTitle className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                                                        Panorama do MÃªs
                                                    </CardTitle>
                                                    <p className="text-xs text-slate-400 font-normal">Clique na barra para ver detalhes do dia</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                                                {new Date(dateFilter).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="h-[350px] w-full cursor-pointer">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={volumeChartData}
                                                    barGap={2}
                                                    onClick={(data) => {
                                                        if (data && data.activePayload && data.activePayload[0]) {
                                                            const payload = data.activePayload[0].payload;
                                                            if (payload.fullDate) {
                                                                setDateFilter(payload.fullDate);
                                                                setViewMode("DiÃ¡rio");
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                                    <Tooltip
                                                        cursor={{ fill: '#f8fafc' }}
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                        labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                                                    />
                                                    <Bar dataKey="success" name="Sucesso" stackId="a" fill={COLORS.success} radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="transferred" name="Transferido" stackId="a" fill={COLORS.neutral} />
                                                    <Bar dataKey="failure" name="Falha" stackId="a" fill={COLORS.failure} radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="flex justify-center flex-wrap gap-6 mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
                                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div> Sucesso</div>
                                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"><div className="w-3 h-3 rounded-full bg-slate-400 shadow-sm shadow-slate-200"></div> Transferido</div>
                                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors"><div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-200"></div> Falha</div>
                                        </div>
                                        {/* Mini Insights do MÃªs */}
                                        <div className="grid grid-cols-3 gap-4 mt-6">
                                            {(() => {
                                                const highestDay = [...volumeChartData].sort((a, b) => b.count - a.count)[0];
                                                const totalMonth = volumeChartData.reduce((acc, curr) => acc + curr.count, 0);
                                                const avgDaily = totalMonth / (volumeChartData.filter(d => d.count > 0).length || 1);
                                                return (
                                                    <>
                                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Pico do MÃªs</p>
                                                            <p className="text-lg font-bold text-slate-800">{highestDay ? highestDay.label : '-'}</p>
                                                            <p className="text-[10px] text-slate-500">{highestDay?.count || 0} chats</p>
                                                        </div>
                                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">MÃ©dia DiÃ¡ria</p>
                                                            <p className="text-lg font-bold text-slate-800">{Math.round(avgDaily)}</p>
                                                            <p className="text-[10px] text-slate-500">chats/dia</p>
                                                        </div>
                                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-center">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total MÃªs</p>
                                                            <p className="text-lg font-bold text-indigo-600">{totalMonth}</p>
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Activity className="h-5 w-5 text-blue-500" /> Sala de OperaÃ§Ãµes</h2>{isToday && activeTickets.length > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-700">Ao Vivo</Badge>}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                                        {(isToday ? activeTickets : data.slice(0, 20)).map((ticket) => {
                                            const isFinished = ticket.status_visual !== "Em andamento"
                                            const unreadCount = isToday && !isFinished ? getUnreadMessages(ticket.telefone, ticket.id_atendente) : 0
                                            const agentOnline = isToday && !isFinished ? isAgentOnline(ticket.id_atendente) : true
                                            const isAbandonRisk = unreadCount > 4 || (unreadCount > 0 && !agentOnline)
                                            let cardClass = "bg-white border-slate-200"; if (isAbandonRisk && isToday) cardClass = "bg-red-50 border-red-300 shadow-md ring-1 ring-red-200 animate-pulse"; else if (unreadCount > 0 && isToday) cardClass = "bg-amber-50 border-amber-200"
                                            return (<Card key={ticket.id} className={`transition-all duration-300 ${cardClass} shadow-sm relative overflow-hidden`}>{isAbandonRisk && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}<CardContent className="p-5"><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wide"><User className="h-3 w-3" />{ticket.id_atendente || "Desconhecido"}{isToday && !isFinished && (<span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-emerald-500' : 'bg-red-400'}`} title={agentOnline ? "Online" : "Offline/Ausente"}></span>)}</div>{unreadCount > 0 && (<Badge className="bg-red-500 text-white hover:bg-red-600 border-0 flex gap-1 animate-bounce"><MessageCircle className="h-3 w-3" /> {unreadCount}</Badge>)}{unreadCount === 0 && (<Badge variant="outline" className="bg-slate-100 text-slate-600 border-0">{ticket.duration_minutes} min</Badge>)}</div><div><p className="text-xs text-slate-400 mb-1">Cliente</p><h3 className="text-lg font-bold text-slate-900 truncate" title={ticket.nome_cliente}>{ticket.nome_cliente || "Sem nome"}</h3><p className="text-xs text-slate-400 truncate mt-1">{ticket.telefone || "-"}</p><div className="flex gap-2 mt-2 flex-wrap">{ticket.origem === 'receptivo' ? (<Badge className="bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold flex items-center gap-1"><Phone className="h-3 w-3" /> RECEPTIVO</Badge>) : ticket.origem === 'ativo' ? (<Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> ATIVO</Badge>) : null}{ticket.motivo && (<Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 font-normal">ðŸ·ï¸ {ticket.motivo}</Badge>)}</div></div>{isAbandonRisk && (<div className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> RISCO DE ABANDONO</div>)}<div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-between items-center"><span className="text-xs text-slate-400">{new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>{isFinished ? (<Badge variant="outline" className="text-xs">{ticket.status_visual}</Badge>) : (<div className="flex items-center gap-1.5"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span><span className="text-xs font-medium text-blue-600">Em Andamento</span></div>)}</div></CardContent></Card>)
                                        })}
                                        {activeTickets.length === 0 && !isToday && data.length === 0 && (<div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400"><Ghost className="h-8 w-8 mb-2 opacity-50" /><p className="text-sm font-medium">Nenhum chamado encontrado no perÃ­odo.</p></div>)}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-3 space-y-6">
                    {/* GrÃ¡ficos laterais mantidos (Motivos + Volume) */}
                    <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative"><CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between"><CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Motivos</CardTitle><button onClick={() => { setSelectedAgentId(null); setSearchTerm(""); setShowModal(true); }} className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1 font-bold"><Search className="h-3 w-3" /> Ver Raio-X</button></CardHeader><CardContent className="p-4">{motivesData.length > 0 ? (<div className="h-[200px] w-full relative"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={motivesData} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">{motivesData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}</Pie><Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} /></PieChart></ResponsiveContainer></div>) : <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">Sem dados</div>}<div className="mt-2 space-y-1 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">{motivesData.map((m) => (<div key={m.name} className="flex justify-between items-center text-xs"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }}></div><span className="text-slate-600 truncate max-w-[120px]" title={m.name}>{m.name}</span></div><span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{m.value}</span></div>))}</div></CardContent></Card>
                    <Card className="border-slate-200 shadow-sm bg-white"><CardHeader className="pb-2 border-b border-slate-100"><CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">{viewMode === "DiÃ¡rio" ? "Volume (Real vs Previsto)" : "EvoluÃ§Ã£o DiÃ¡ria (MÃªs)"}</CardTitle></CardHeader><CardContent className="p-4"><div className="h-[150px] w-full"><ResponsiveContainer width="100%" height="100%">{viewMode === "DiÃ¡rio" ? (<ComposedChart data={volumeChartData}><defs><linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" hide tick={{ fontSize: 10 }} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Area type="monotone" dataKey="real" stroke={COLORS.primary} fill="url(#colorReal)" strokeWidth={2} /><Line type="monotone" dataKey="previsto" stroke={COLORS.prediction} strokeDasharray="5 5" strokeWidth={2} dot={{ r: 2 }} /></ComposedChart>) : (<AreaChart data={volumeChartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" hide tick={{ fontSize: 10 }} interval={2} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Area type="monotone" dataKey="count" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.2} strokeWidth={2} /></AreaChart>)}</ResponsiveContainer></div></CardContent></Card>
                </div>
            </div>

            {/* MODAIS (RANKING, PREVISÃƒO, SALA DE GUERRA) - MANTIDOS IGUAIS */}
            {/* 1. PREVISÃƒO SEMANAL */}
            {showPredictionModal && weeklyPrediction && (() => {
                // Calculo do pico previsto
                const picoPrevisto = weeklyPrediction.projecao7Dias?.reduce(
                    (prev, current) => (prev.previsao > current.previsao) ? prev : current
                ) || null

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 bg-opacity-98 backdrop-blur-md p-4 animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden border-2 border-indigo-200">

                            {/* ðŸŽ¯ HEADER PREMIUM */}
                            <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 p-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
                                <div className="relative flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl">
                                            <Sparkles className="h-8 w-8 text-white animate-pulse" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h2 className="text-2xl font-black text-white tracking-tight">
                                                    Dashboard Preditivo de Atendimento
                                                </h2>
                                                {weeklyPrediction.mock && (
                                                    <span className="bg-amber-500 text-white text-xs font-bold uppercase px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                                        ðŸ§ª Modo SimulaÃ§Ã£o
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-indigo-100 text-sm mt-1 font-medium">
                                                AnÃ¡lise preditiva baseada em 90 dias de histÃ³rico â€¢ IA de AlocaÃ§Ã£o DinÃ¢mica
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowPredictionModal(false)}
                                        className="bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-xl transition-all text-white border border-white/20"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            {/* ðŸ“Š CONTEÃšDO PRINCIPAL - LAYOUT 2 COLUNAS */}
                            <div className="p-8 bg-gradient-to-br from-slate-50 to-white">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                                    {/* â•â•â• COLUNA ESQUERDA (8/12) - GRÃFICO E MÃ‰TRICAS â•â•â• */}
                                    <div className="lg:col-span-8 space-y-6">

                                        {/* CARDS DE MÃ‰TRICAS */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <MetricCard
                                                icon={weeklyPrediction.tendencia?.includes('crescente') ? TrendingUp : TrendingDown}
                                                label="TendÃªncia"
                                                value={weeklyPrediction.tendencia || "-"}
                                                trend={weeklyPrediction.tendencia?.includes('crescente') ? 'up' : 'down'}
                                                iconColor={weeklyPrediction.tendencia?.includes('crescente')
                                                    ? "bg-emerald-100 text-emerald-600"
                                                    : "bg-amber-100 text-amber-600"}
                                            />
                                            <MetricCard
                                                icon={Users}
                                                label="MÃ©dia HistÃ³rica"
                                                value={weeklyPrediction.mediaHistorica ? `${weeklyPrediction.mediaHistorica}/dia` : "-"}
                                                iconColor="bg-blue-100 text-blue-600"
                                            />
                                            <MetricCard
                                                icon={Calendar}
                                                label="Pico Previsto"
                                                value={picoPrevisto?.dia || "-"}
                                                iconColor="bg-purple-100 text-indigo-600"
                                            />
                                        </div>

                                        {/* GRÃFICO PRINCIPAL */}
                                        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-lg p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                                    <Activity className="h-4 w-4 text-indigo-600" />
                                                    Curva de Demanda Prevista (7 Dias)
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                                        <span>PrevisÃ£o</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-3 h-0.5 bg-slate-400"></div>
                                                        <span>MÃ©dia</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="h-[350px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={weeklyPrediction.projecao7Dias}>
                                                        <defs>
                                                            <linearGradient id="colorPrevisao" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                        <XAxis
                                                            dataKey="dia"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                                            width={40}
                                                        />
                                                        <Tooltip
                                                            cursor={{ stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' }}
                                                            contentStyle={{
                                                                borderRadius: '12px',
                                                                border: '2px solid #8b5cf6',
                                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
                                                                backgroundColor: '#ffffff'
                                                            }}
                                                            labelFormatter={(label, payload) => payload[0]?.payload.dataCompleta || label}
                                                            formatter={(value: number) => [`${value} atendimentos`, 'PrevisÃ£o']}
                                                        />
                                                        {weeklyPrediction.mediaHistorica && (
                                                            <ReferenceLine
                                                                y={weeklyPrediction.mediaHistorica}
                                                                stroke="#94a3b8"
                                                                strokeDasharray="5 5"
                                                                strokeWidth={2}
                                                                label={{
                                                                    position: 'top',
                                                                    value: `MÃ©dia: ${weeklyPrediction.mediaHistorica}`,
                                                                    fill: '#64748b',
                                                                    fontSize: 11,
                                                                    fontWeight: 700
                                                                }}
                                                            />
                                                        )}
                                                        <Area
                                                            type="monotone"
                                                            dataKey="previsao"
                                                            stroke="#8b5cf6"
                                                            strokeWidth={3}
                                                            fill="url(#colorPrevisao)"
                                                            activeDot={{ r: 8, strokeWidth: 3, stroke: '#ffffff', fill: '#7c3aed' }}
                                                            animationDuration={1000}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* â•â•â• COLUNA DIREITA (4/12) - INSIGHTS E AÃ‡Ã•ES â•â•â• */}
                                    <div className="lg:col-span-4 space-y-6">

                                        {/* ANÃLISE DE PICO */}
                                        {picoPrevisto && (
                                            <div className="bg-gradient-to-br from-indigo-50 to-indigo-50 rounded-2xl border-2 border-indigo-200 p-5 space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-indigo-600 p-2 rounded-lg">
                                                        <AlertTriangle className="h-5 w-5 text-white" />
                                                    </div>
                                                    <h4 className="text-sm font-extrabold text-indigo-900 uppercase tracking-wide">
                                                        AnÃ¡lise de Pico
                                                    </h4>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="bg-white rounded-xl p-4 shadow-sm">
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Dia CrÃ­tico</p>
                                                        <p className="text-2xl font-black text-indigo-900">{picoPrevisto.dia}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{picoPrevisto.dataCompleta}</p>
                                                    </div>
                                                    <div className="bg-white rounded-xl p-4 shadow-sm">
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Volume Esperado</p>
                                                        <p className="text-3xl font-black text-indigo-600">{picoPrevisto.previsao}</p>
                                                        <p className="text-xs text-emerald-600 font-bold mt-1">
                                                            +{((picoPrevisto.previsao / (weeklyPrediction.mediaHistorica || 1) - 1) * 100).toFixed(0)}% vs mÃ©dia
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* RECOMENDAÃ‡Ã•ES ACIONÃVEIS */}
                                        <RecommendationPanel recomendacao={weeklyPrediction.recomendacao} />

                                        {/* RODAPÃ‰ INFORMATIVO */}
                                        <div className="bg-slate-100 rounded-xl p-4 border border-slate-200">
                                            <div className="flex items-start gap-2">
                                                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                                    <strong>Modelo Preditivo:</strong> Algoritmo de regressÃ£o linear baseado em padrÃµes histÃ³ricos.
                                                    AtualizaÃ§Ã£o automÃ¡tica a cada 24h.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* 2. RANKING DE GAMIFICAÃ‡ÃƒO (MANTIDO) */}
            {showGamingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col relative" style={{ maxHeight: '90vh' }}>
                        <button onClick={() => setShowGamingModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2"><X className="h-6 w-6" /></button>
                        <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-8 text-center">
                            <h2 className="text-3xl font-black text-white uppercase flex items-center justify-center gap-3"><Trophy className="h-8 w-8 text-yellow-300" /> Liga de Performance</h2>
                            <p className="text-amber-100 text-sm mt-2 flex justify-center gap-2">Ranking {viewMode} <button onClick={() => fetchRanking(true)} className="hover:text-white transition-colors"><RefreshCw className={`h-4 w-4 ${rankingLoading ? 'animate-spin' : ''}`} /></button></p>
                        </div>
                        <div className="p-8 bg-slate-900 text-slate-100 flex-1 overflow-y-auto">
                            {rankingData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-500"><Ghost className="h-12 w-12 mb-4 opacity-50" /><p>Sem dados de ranking.</p></div>
                            ) : (
                                <div className="space-y-2">
                                    {rankingData.map((jogador, index) => (
                                        <div key={jogador.nome} className="flex items-center bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                            <div className="w-8 text-center font-bold text-slate-500 mr-4">#{index + 1}</div>
                                            <div className="flex-1 flex items-center gap-3"><Avatar className="h-10 w-10 border border-slate-600"><AvatarFallback className="text-slate-800 font-bold">{jogador.avatar_initials}</AvatarFallback></Avatar><div><div className="font-bold text-white">{jogador.nome}</div><div className="text-xs text-slate-400 flex gap-3"><span>{jogador.tickets} tickets</span><span>{jogador.tma} min</span></div></div></div>
                                            <div className="flex gap-1 mr-4">{jogador.conquistas.map((c, i) => (<span key={i} className="p-1 rounded-md bg-slate-700" title={String(c)}>{String(c).includes('Fire') ? 'ðŸ”¥' : String(c).includes('PlantÃ£o') ? 'ðŸ±' : 'âš¡'}</span>))}</div>
                                            <div className="text-right w-20"><div className="text-xl font-bold text-amber-400">{jogador.pontos}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SALA DE GUERRA (RAIO-X) - MANTIDO COMPLETO (CÃ³digo muito longo, nÃ£o alterado) */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-2 animate-in fade-in duration-200">
                    <div className="bg-slate-50 w-full h-full max-w-[1920px] rounded-xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-700">
                        {/* Sidebar + ConteÃºdo Principal mantidos iguais */}
                        <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full"><div className="p-4 border-b border-slate-100 bg-slate-50"><h2 className="font-bold text-slate-800 flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> Sala de Guerra</h2><p className="text-xs text-slate-500 mt-1">AnÃ¡lise de Performance Individual</p></div><div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar"><button onClick={() => setSelectedAgentId(null)} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${selectedAgentId === null ? "bg-indigo-50 border border-indigo-200 shadow-sm" : "hover:bg-slate-50 border border-transparent"}`}><div className={`p-2 rounded-full ${selectedAgentId === null ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}><Users className="h-5 w-5" /></div><div><p className={`font-bold text-sm ${selectedAgentId === null ? "text-indigo-900" : "text-slate-700"}`}>VisÃ£o Geral</p><p className="text-xs text-slate-400">Todos os Agentes</p></div></button><div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">Agentes Ativos</div>{agentStats.map(agent => (<button key={agent.name} onClick={() => setSelectedAgentId(agent.name)} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-all ${selectedAgentId === agent.name ? "bg-blue-50 border border-blue-200 shadow-sm" : "hover:bg-slate-50 border border-transparent"}`}><Avatar className="h-9 w-9 border border-slate-200"><AvatarFallback className={`${selectedAgentId === agent.name ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"} text-xs font-bold`}>{agent.initials}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex justify-between items-center"><p className={`font-bold text-sm truncate ${selectedAgentId === agent.name ? "text-blue-900" : "text-slate-700"}`}>{agent.name}</p><Badge variant="secondary" className="text-[10px] bg-slate-100">{agent.total}</Badge></div><div className="flex gap-2 items-center mt-0.5"><Progress value={agent.rate} className="h-1 w-full" /><span className="text-[10px] text-slate-400">{agent.rate.toFixed(0)}%</span></div></div></button>))}</div></div>
                        <div className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
                            <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-sm z-10"><div><h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">{selectedAgentId ? (<><User className="h-5 w-5 text-blue-500" /> {selectedAgentId}</>) : (<><Target className="h-5 w-5 text-indigo-500" />VisÃ£o Global da OperaÃ§Ã£o</>)}</h2><p className="text-xs text-slate-500">Filtrando dados de: {new Date(dateFilter).toLocaleDateString('pt-BR')}</p></div><button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-red-50 hover:text-red-600 p-2 rounded-full transition-colors border border-slate-200"><X className="h-5 w-5" /></button></div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"><Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Activity className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Total Atendimentos</p><h3 className="text-2xl font-bold text-slate-900">{warRoomData.total}</h3></div></CardContent></Card><Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-4"><div className={`p-3 rounded-lg ${warRoomData.successRate >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}><CheckCircle2 className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Taxa de Sucesso</p><h3 className="text-2xl font-bold text-slate-900">{warRoomData.successRate}%</h3></div></CardContent></Card><Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><Clock className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Tempo MÃ©dio (TMA)</p><h3 className="text-2xl font-bold text-slate-900">{warRoomData.tma} min</h3></div></CardContent></Card><Card className="border-slate-200 bg-white shadow-sm"><CardContent className="p-4 flex items-center gap-4"><div className="p-3 bg-amber-50 rounded-lg text-amber-600"><TrendingUp className="h-6 w-6" /></div><div><p className="text-sm text-slate-500 font-medium">Principal Motivo</p><h3 className="text-lg font-bold text-slate-900 truncate max-w-[150px]">{warRoomData.motives[0]?.name || "-"}</h3></div></CardContent></Card></div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                    <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                            <CardTitle className="text-sm font-bold text-slate-500 uppercase">CorrelaÃ§Ã£o: Volume x Qualidade</CardTitle>
                                            <div className="flex gap-4 text-[10px] font-bold">
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-sm"></div> Volume</div>
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> EficiÃªncia %</div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="h-[250px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={warRoomData.chart}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#10b981' }} unit="%" domain={[0, 100]} />
                                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    <Bar yAxisId="left" dataKey="count" name="Volume" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={30} />
                                                    <Line yAxisId="right" type="monotone" dataKey="efficiency" name="EficiÃªncia" stroke={COLORS.success} strokeWidth={2} dot={{ r: 3, fill: COLORS.success }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <div className="space-y-6">
                                        <Card className="border-slate-200 shadow-sm">
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-500 uppercase">Top Motivos</CardTitle></CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">{warRoomData.motives.map((m, i) => (<div key={m.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400 w-4">{i + 1}.</span><span className="text-sm text-slate-700 truncate max-w-[150px]" title={m.name}>{m.name}</span></div><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${(m.value / warRoomData.total) * 100}%` }}></div></div><span className="text-xs font-bold text-slate-800">{m.value}</span></div></div>))}</div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-slate-200 shadow-sm">
                                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-slate-500 uppercase">Top Clientes</CardTitle></CardHeader>
                                            <CardContent>
                                                <div className="space-y-3">
                                                    {warRoomData.topClients.length === 0 ? <p className="text-xs text-slate-400 italic">Sem dados de clientes.</p> : warRoomData.topClients.map((c, i) => (
                                                        <div key={i} className="flex items-center justify-between group">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">{i + 1}</div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-xs font-bold text-slate-700 truncate w-24" title={c.name}>{c.name}</p>
                                                                    <p className="text-[9px] text-slate-400">{new Date(c.lastSeen).toLocaleDateString('pt-BR')}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{c.count}</span>
                                                                {/*
                                                                    âš ï¸ CÃ“DIGO INATIVO: NOTA DO CLIENTE
                                                                    Futuramente integrar com backend de reputaÃ§Ã£o.

                                                                    <div className="flex gap-0.5 mt-0.5">
                                                                        {[1,2,3,4,5].map(star => (
                                                                            <span key={star} className={`text-[8px] ${star <= 4 ? 'text-amber-400' : 'text-slate-200'}`}>â˜…</span>
                                                                        ))}
                                                                    </div>
                                                                */}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col"><div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Filter className="h-4 w-4" /> Detalhamento de Atendimentos</h3><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" placeholder="Buscar cliente, telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div></div><div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50/50 hover:bg-slate-50/50"><TableHead className="font-bold text-slate-700">Data/Hora</TableHead><TableHead className="font-bold text-slate-700">Cliente</TableHead>{!selectedAgentId && <TableHead className="font-bold text-slate-700">Atendente</TableHead>}<TableHead className="font-bold text-slate-700">Motivo</TableHead><TableHead className="font-bold text-slate-700 text-center">Status</TableHead><TableHead className="font-bold text-slate-700 text-right">DuraÃ§Ã£o</TableHead></TableRow></TableHeader><TableBody>{warRoomData.list.map((ticket) => (<TableRow key={ticket.id} className="hover:bg-slate-50 transition-colors"><TableCell className="font-mono text-xs text-slate-500">{viewMode === "Mensal" ? new Date(ticket.created_at).toLocaleDateString('pt-BR') : new Date(ticket.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell><TableCell><div className="flex items-center gap-2"><div className="font-medium text-slate-900 flex items-center gap-2">{ticket.nome_cliente}{ticket.origem === 'ativo' && (<span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full" title="Atendente entrou em contato"><MessageCircle className="h-3 w-3" />Ativo</span>)}</div><div className="text-xs text-slate-400">{ticket.telefone}</div></div></TableCell>{!selectedAgentId && (<TableCell className="text-xs text-slate-600">{ticket.id_atendente}</TableCell>)}<TableCell>{ticket.motivo ? (<Badge variant="secondary" className="text-[10px]">{ticket.motivo}</Badge>) : (<span className="text-xs text-slate-400 italic">-</span>)}</TableCell><TableCell className="text-center"><Badge variant={ticket.status_visual === "Sucesso" ? "default" : ticket.status_visual === "Falha" ? "destructive" : "secondary"} className="text-[10px]">{ticket.status_visual}</Badge></TableCell><TableCell className="text-right text-xs font-mono text-slate-600">{ticket.duration_minutes} min</TableCell></TableRow>))}</TableBody></Table></div>{warRoomData.totalPages > 1 && (<div className="p-4 border-t border-slate-100 flex justify-between items-center"><span className="text-xs text-slate-500">{warRoomData.fullListLength} registros totais</span><div className="flex gap-2"><button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs text-slate-600 px-3 py-1.5">PÃ¡gina {currentPage} de {warRoomData.totalPages}</span><button onClick={() => setCurrentPage(p => Math.min(warRoomData.totalPages, p + 1))} disabled={currentPage === warRoomData.totalPages} className="p-1.5 rounded border border-slate-200 disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button></div></div>)}</Card>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* 4. MAPA DE CLIENTES (IMPLEMENTAÃ‡ÃƒO INLINE) */}
            {showClientModal && (() => {
                // Componentes auxiliares
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

                return (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-white/20">
                            {/* HEADER */}
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
                                        <p className="text-slate-500 text-sm font-medium">InteligÃªncia de relacionamento e satisfaÃ§Ã£o</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Buscar cliente ou tel..."
                                            className="pl-10 bg-slate-100 border-none focus:ring-2 ring-indigo-500 rounded-xl w-full py-2 text-sm outline-none"
                                            value={clientSearchTerm}
                                            onChange={(e) => setClientSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => { setShowClientModal(false); setClientSearchTerm(""); }}
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
                                        subtitle="Clientes Ãºnicos identificados"
                                    />
                                    <StatCard
                                        title="MÃ©dia de SatisfaÃ§Ã£o"
                                        value={clientMapData.stats.mediaGeral.toFixed(2)}
                                        icon={Star}
                                        colorClass="bg-amber-50 text-amber-600"
                                        subtitle="Baseado em avaliaÃ§Ãµes reais"
                                    />
                                    <StatCard
                                        title="Volume de Contatos"
                                        value={clientMapData.stats.totalContatos}
                                        icon={MessageSquare}
                                        colorClass="bg-indigo-50 text-indigo-600"
                                        subtitle="Total de interaÃ§Ãµes no perÃ­odo"
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
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                                                                {i + 1}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-slate-800 text-sm break-words" title={c.nome}>{c.nome}</h4>
                                                                <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {c.telefone}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0 ml-3">
                                                            <span className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{c.total}</span>
                                                            <p className="text-[9px] text-slate-400 uppercase font-bold">Contatos</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded">
                                                            {c.topMotive}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                            <User className="h-3 w-3" />
                                                            <span>Ãšltimo: {c.lastAgent.split(' ')[0]}</span>
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
                                                    <p className="text-sm text-slate-400 italic">Nenhuma avaliaÃ§Ã£o positiva</p>
                                                </div>
                                            ) : clientMapData.topAvaliacao.map((c, i) => (
                                                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-800 text-sm break-words" title={c.nome}>{c.nome}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <RatingBadge rating={c.mediaNum} />
                                                                <span className="text-[10px] text-slate-400">({c.qtdAvaliacao} notas)</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-emerald-50 p-1.5 rounded-lg shrink-0">
                                                            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <Calendar className="h-3 w-3 text-slate-300" />
                                                        <span className="text-[10px] text-slate-400">Ãšltimo contato: {new Date(c.lastDate).toLocaleDateString()}</span>
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
                                                AtenÃ§Ã£o CrÃ­tica
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
                                                    <p className="text-[10px] text-emerald-600/70">Nenhum cliente com nota crÃ­tica no perÃ­odo.</p>
                                                </div>
                                            ) : clientMapData.detratores.map((c, i) => (
                                                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 border-l-4 border-l-red-500 hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-800 text-sm break-words" title={c.nome}>{c.nome}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <RatingBadge rating={c.mediaNum} />
                                                                <span className="text-[10px] text-red-400 font-medium">Urgente</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-red-50 p-1.5 rounded-lg shrink-0">
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
                                    * Dados processados em tempo real com base no histÃ³rico de atendimentos.
                                </p>
                                <button
                                    onClick={() => { setShowClientModal(false); setClientSearchTerm(""); }}
                                    className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-lg shadow-slate-200 active:scale-95"
                                >
                                    Fechar Dashboard
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}

