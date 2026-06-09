import React from 'react';
import { requireProjectAccess } from '@/lib/security';
import { prisma } from '@/lib/prisma';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  CheckSquare, 
  Target, 
  Sparkles,
  AlertTriangle,
  Compass,
  Frown
} from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ProjectDashboardPage({ params }: Props) {
  const { id: projectId } = await params;
  
  // 1. Valida acesso ao projeto
  await requireProjectAccess(projectId);

  // 2. Busca dados de estatísticas básicas
  const activeLeadsCount = await prisma.lead.count({
    where: {
      projectId,
      pipelineEntries: {
        some: {
          status: 'ACTIVE'
        }
      }
    },
  });

  const valueSumResult = await prisma.pipelineEntry.aggregate({
    where: {
      status: 'ACTIVE',
      pipeline: {
        projectId: projectId
      }
    },
    _sum: { value: true },
  });
  const totalPipelineValue = valueSumResult._sum.value || 0;

  const pendingTasksCount = await prisma.task.count({
    where: { projectId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  });

  // Cálculo de taxa de conversão (Leads Ganhas / Total Histórico de Leads)
  const wonLeadsCount = await prisma.lead.count({
    where: { 
      projectId, 
      pipelineEntries: {
        some: {
          stage: {
            name: { in: ['Fechado (Ganho)', 'Fechado'] }
          }
        }
      }
    },
  });

  const totalLeadsHistorical = await prisma.lead.count({
    where: { projectId },
  });

  const conversionRate = totalLeadsHistorical > 0 
    ? ((wonLeadsCount / totalLeadsHistorical) * 100).toFixed(1)
    : '0.0';

  // 3. Distribuição de Leads por Estágios
  const stagesData = await prisma.stage.findMany({
    where: { pipeline: { projectId } },
    orderBy: { order: 'asc' },
    include: {
      pipelineEntries: {
        where: { status: 'ACTIVE' },
        select: { value: true }
      }
    }
  });

  const stageBreakdown = stagesData.map(stage => {
    const count = stage.pipelineEntries.length;
    const value = stage.pipelineEntries.reduce((sum, entry) => sum + entry.value, 0);
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color,
      count,
      value
    };
  });

  // 4. Distribuição de Leads por Origem (adendo)
  const originsData = await prisma.origin.findMany({
    where: { projectId },
    include: {
      leads: {
        where: {
          pipelineEntries: {
            some: {
              status: 'ACTIVE'
            }
          }
        }
      }
    }
  });

  // Contagem de leads sem origem cadastrada
  const leadsWithoutOriginCount = await prisma.lead.count({
    where: {
      projectId,
      originId: null,
      pipelineEntries: {
        some: {
          status: 'ACTIVE'
        }
      }
    }
  });

  const originBreakdown = originsData.map(origin => ({
    id: origin.id,
    name: origin.name,
    count: origin.leads.length
  }));

  if (leadsWithoutOriginCount > 0) {
    originBreakdown.push({
      id: 'none',
      name: 'Sem Origem Especificada',
      count: leadsWithoutOriginCount
    });
  }

  // 5. Relatório de Oportunidades Perdidas por Motivo (adendo)
  const lostReasonsData = await prisma.lostStatus.findMany({
    where: { projectId },
    include: {
      pipelineEntries: {
        where: { status: 'LOST' }
      }
    }
  });

  const lostWithoutReasonCount = await prisma.pipelineEntry.count({
    where: {
      status: 'LOST',
      lostStatusId: null,
      pipeline: {
        projectId: projectId
      }
    }
  });

  const lostReasonBreakdown = lostReasonsData.map(reason => ({
    id: reason.id,
    reason: reason.reason,
    count: reason.pipelineEntries.length
  }));

  if (lostWithoutReasonCount > 0) {
    lostReasonBreakdown.push({
      id: 'none',
      reason: 'Outros / Não informado',
      count: lostWithoutReasonCount
    });
  }

  const totalLostLeads = lostReasonBreakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex-1 p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      
      {/* Top Banner de Boas Vindas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-accent bg-accent-glow px-2.5 py-1 rounded-full border border-border-glass">
            Decisor • ICP Ideal • High Ticket
          </span>
          <h1 className="text-3xl font-extrabold font-display text-white mt-2 tracking-tight">
            Dashboard Estratégico
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Métricas de desempenho e saúde comercial do seu projeto.
          </p>
        </div>
      </div>

      {/* Grid de Cards Métricas (Totalizadores) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Leads Ativos */}
        <div className="bg-glass-1 border border-border-subtle border-l-accent rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Leads Ativos</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-display">{activeLeadsCount}</h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-text-secondary mt-3">Negociações ativas no funil</p>
        </div>

        {/* Card 2: Valor Total */}
        <div className="bg-glass-1 border border-border-subtle border-l-[#abfe37] rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Valor em Pipeline</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-display">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalPipelineValue)}
              </h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-[#abfe37]/10 flex items-center justify-center text-[#abfe37]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-text-secondary mt-3">Valor total ponderado estimado</p>
        </div>

        {/* Card 3: Taxa de Conversão */}
        <div className="bg-glass-1 border border-border-subtle border-l-purple-500 rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Taxa de Conversão</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-display">{conversionRate}%</h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-text-secondary mt-3">De leads geradas para fechadas</p>
        </div>

        {/* Card 4: Tarefas Pendentes */}
        <div className="bg-glass-1 border border-border-subtle border-l-orange-400 rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Ações Pendentes</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 font-display">{pendingTasksCount}</h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-orange-400/10 flex items-center justify-center text-orange-400">
              <CheckSquare className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[10px] text-text-secondary mt-3">Tarefas aguardando execução</p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel 1: Pipeline por Estágio (Largura 2 colunas no desktop) */}
        <div className="lg:col-span-2 bg-glass-1 border border-border-subtle rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Volume por Estágio do Funil
            </h4>
            <div className="space-y-4">
              {stageBreakdown.map((stage) => {
                // Calcula percentual para a barra de progresso
                const maxLeads = Math.max(...stageBreakdown.map(s => s.count), 1);
                const percent = ((stage.count / maxLeads) * 100);

                return (
                  <div key={stage.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2 text-white">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </span>
                      <span className="text-text-secondary">
                        {stage.count} {stage.count === 1 ? 'lead' : 'leads'} • <span className="text-accent-light font-bold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stage.value)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-glass-4 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${percent}%`, 
                          backgroundColor: stage.color 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Painel 2: Origens de Leads */}
        <div className="bg-glass-1 border border-border-subtle rounded-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider mb-5 flex items-center gap-2">
              <Compass className="h-4 w-4 text-accent" />
              Origem dos Leads
            </h4>
            <div className="space-y-3">
              {originBreakdown.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">Nenhuma origem mapeada.</p>
              ) : (
                originBreakdown.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs border-b border-[rgba(255,255,255,0.03)] pb-2 last:border-0 last:pb-0">
                    <span className="text-text-secondary">{item.name}</span>
                    <span className="font-bold text-white bg-glass-3 px-2 py-0.5 rounded border border-border-subtle">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Relatório de Perdas (Adendo) */}
      <div className="bg-glass-1 border border-border-subtle rounded-xl p-6 shadow-xl">
        <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider mb-5 flex items-center gap-2">
          <Frown className="h-4 w-4 text-danger" />
          Motivos de Perda (Oportunidades Perdidas)
        </h4>
        
        {totalLostLeads === 0 ? (
          <div className="py-6 text-center text-xs text-text-secondary">
            Nenhuma oportunidade foi marcada como perdida neste projeto até o momento.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lostReasonBreakdown.map((item) => {
                const percent = ((item.count / totalLostLeads) * 100).toFixed(0);
                return (
                  <div key={item.id} className="bg-glass-1 border border-border-subtle rounded-lg p-4 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-white leading-tight">{item.reason}</span>
                      <span className="text-xs text-danger font-extrabold bg-danger/10 px-2 py-0.5 rounded-full border border-danger/20">
                        {item.count}
                      </span>
                    </div>
                    <div>
                      <div className="h-1 w-full bg-glass-4 rounded-full overflow-hidden">
                        <div className="h-full bg-danger rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-text-secondary mt-1">
                        <span>Relevância</span>
                        <span>{percent}% do total perdido</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-right text-[11px] text-text-secondary pt-2">
              Total de leads perdidos no projeto: <span className="text-white font-bold">{totalLostLeads}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
