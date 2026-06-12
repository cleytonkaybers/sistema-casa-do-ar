import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { listAll } from '@/lib/utils/listAll';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Settings, Upload, Download, X, Hash, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import NoPermission from '../components/NoPermission';
import { usePermissions } from '../components/auth/PermissionGuard';

const LUCIDE_ICONS = [
  'Snowflake', 'Settings', 'Home', 'Briefcase', 'Zap', 'Star', 'Heart',
  'Clock', 'Calendar', 'Users', 'Shield', 'Lock', 'AlertCircle', 'CheckCircle',
  'XCircle', 'HelpCircle', 'Info', 'Trash2', 'Edit', 'Plus', 'Minus'
];

export default function ConfiguracoesPage() {
  const { isAdmin } = usePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  const { data: settings = null } = useQuery({
    queryKey: ['companySettings'],
    queryFn: async () => {
      const result = await listAll('CompanySettings');
      return result.length > 0 ? result[0] : null;
    },
  });

  const [formData, setFormData] = useState({
    company_name: '',
    company_icon: 'Snowflake',
    company_logo_url: '',
  });
  // Banner lido diretamente do localStorage ao montar
  const [bannerUrl, setBannerUrl] = useState(() => localStorage.getItem('casadoar_pdf_banner_url') || '');
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || '',
        company_icon: settings.company_icon || 'Snowflake',
        company_logo_url: settings.company_logo_url || '',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      if (settings?.id) {
        return base44.entities.CompanySettings.update(settings.id, data);
      } else {
        return base44.entities.CompanySettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Por favor, selecione uma imagem válida'); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // Atualiza estado local
      const novoFormData = { ...formData, company_logo_url: file_url };
      setFormData(novoFormData);
      // Salva imediatamente no banco sem precisar clicar em Salvar
      if (settings?.id) {
        await base44.entities.CompanySettings.update(settings.id, novoFormData);
      } else {
        await base44.entities.CompanySettings.create(novoFormData);
      }
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      toast.success('Logo salvo com sucesso!');
    } catch { toast.error('Erro ao carregar a imagem'); }
    finally { setUploading(false); }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Por favor, selecione uma imagem válida'); return; }
    setUploadingBanner(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // 1. Salva no localStorage imediatamente (garantido)
      const { saveBannerUrl } = await import('@/lib/pdfBanner');
      saveBannerUrl(file_url);
      setBannerUrl(file_url);
      // 2. Tenta salvar também na entidade PDFSettings (backup cross-device)
      try {
        const existing = await listAll('PDFSettings');
        if (existing.length > 0) {
          await base44.entities.PDFSettings.update(existing[0].id, { banner_url: file_url });
        } else {
          await base44.entities.PDFSettings.create({ banner_url: file_url });
        }
      } catch { /* entidade pode não existir ainda — localStorage já garante */ }
      toast.success('Banner salvo com sucesso!');
    } catch { toast.error('Erro ao fazer upload do banner'); }
    finally { setUploadingBanner(false); }
  };

  const handleRemoveBanner = async () => {
    const { saveBannerUrl } = await import('@/lib/pdfBanner');
    saveBannerUrl('');
    setBannerUrl('');
    try {
      const existing = await listAll('PDFSettings');
      if (existing.length > 0) {
        await base44.entities.PDFSettings.update(existing[0].id, { banner_url: '' });
      }
    } catch { /* silent */ }
  };

  const handleDownloadLogo = () => {
    if (!formData.company_logo_url) return;
    const link = document.createElement('a');
    link.href = formData.company_logo_url;
    link.download = `logo-${formData.company_name}.png`;
    link.click();
  };

  const handleSave = () => {
    if (!formData.company_name.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }
    updateMutation.mutate(formData);
  };

  const [limpando, setLimpando] = useState(false);
  const handleLimparComissoesDuplicadas = async () => {
    // Início desta semana (segunda-feira)
    const hoje = new Date();
    const diaSemana = hoje.getDay(); // 0=dom, 1=seg...
    const diasAteLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diasAteLunes);
    inicioSemana.setHours(0, 0, 0, 0);

    if (!confirm(`Isso vai remover lançamentos de comissão com status "pendente" de serviços anteriores a ${inicioSemana.toLocaleDateString('pt-BR')}, revertendo os créditos dos técnicos. Continuar?`)) return;
    setLimpando(true);
    try {
      const [todoLanc, todosServicos, tecnicosFinanceiros] = await Promise.all([
        listAll('LancamentoFinanceiro'),
        listAll('Servico'),
        listAll('TecnicoFinanceiro'),
      ]);

      const servicoMap = Object.fromEntries(todosServicos.map(s => [s.id, s]));

      const duplicados = todoLanc.filter(l => {
        if (l.status !== 'pendente') return false; // manter os já pagos
        const servico = servicoMap[l.servico_id];
        if (!servico) return false;
        const dataServico = new Date(servico.data_programada || servico.data_conclusao || '');
        return dataServico < inicioSemana;
      });

      if (duplicados.length === 0) {
        toast.info('Nenhum lançamento duplicado encontrado.');
        setLimpando(false);
        return;
      }

      // Reverter créditos por técnico
      const revertPorTecnico = {};
      duplicados.forEach(l => {
        const tid = l.tecnico_id;
        if (!revertPorTecnico[tid]) revertPorTecnico[tid] = 0;
        revertPorTecnico[tid] += (l.valor_comissao_tecnico || 0);
      });

      await Promise.all([
        // Deletar lançamentos
        ...duplicados.map(l => base44.entities.LancamentoFinanceiro.delete(l.id)),
        // Reverter créditos_pendentes dos técnicos
        ...tecnicosFinanceiros
          .filter(t => revertPorTecnico[t.tecnico_id] !== undefined)
          .map(t => base44.entities.TecnicoFinanceiro.update(t.id, {
            credito_pendente: Math.max(0, (t.credito_pendente || 0) - revertPorTecnico[t.tecnico_id]),
            total_ganho: Math.max(0, (t.total_ganho || 0) - revertPorTecnico[t.tecnico_id]),
          })),
      ]);

      toast.success(`${duplicados.length} lançamentos duplicados removidos e créditos revertidos!`);
    } catch (err) {
      toast.error('Erro na limpeza: ' + (err?.message || err));
    } finally {
      setLimpando(false);
    }
  };

  const [backfilling, setBackfilling] = useState(false);
  const handleBackfillOS = async () => {
    if (!confirm('Isso vai numerar todos os serviços que ainda não têm número de OS, ordenados por data. Continuar?')) return;
    setBackfilling(true);
    try {
      const todos = await listAll('Servico', 'data_programada');
      const semOS = todos.filter(s => !s.os_numero);
      const maxExistente = todos
        .map(s => parseInt((s.os_numero || '').replace(/\D/g, '') || '0'))
        .reduce((max, n) => Math.max(max, n), 0);

      let contador = maxExistente;
      for (const s of semOS) {
        contador++;
        const patch = { os_numero: `OS-${String(contador).padStart(4, '0')}` };
        // Se já concluído, marcar comissao_gerada=true para evitar re-disparo de comissões
        if (s.status === 'concluido') patch.comissao_gerada = true;
        await base44.entities.Servico.update(s.id, patch);
      }
      toast.success(`${semOS.length} serviços numerados com sucesso!`);
    } catch (err) {
      toast.error('Erro ao numerar serviços: ' + (err?.message || err));
    } finally {
      setBackfilling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return <NoPermission />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Configurações</h1>
          <p className="text-gray-500 mt-1">Personalize as informações da sua empresa</p>
        </div>
      </div>

      {/* Card de limpeza de comissões duplicadas */}
      <Card className="border-2 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Limpar Comissões Duplicadas
          </CardTitle>
          <CardDescription>Remove lançamentos de comissão com status "pendente" gerados incorretamente para serviços de semanas anteriores, revertendo os créditos dos técnicos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleLimparComissoesDuplicadas}
            disabled={limpando}
            variant="outline"
            className="w-full h-11 border-red-300 text-red-700 hover:bg-red-50"
          >
            {limpando ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Limpando...</>
            ) : (
              <><Trash2 className="w-4 h-4 mr-2" />Remover Lançamentos Duplicados</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Card de numeração OS */}
      <Card className="border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-orange-500" />
            Numeração de Ordens de Serviço
          </CardTitle>
          <CardDescription>Numera automaticamente os serviços antigos que ainda não possuem número de OS (OS-0001, OS-0002...)</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleBackfillOS}
            disabled={backfilling}
            variant="outline"
            className="w-full h-11 border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            {backfilling ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Numerando serviços...</>
            ) : (
              <><Hash className="w-4 h-4 mr-2" />Numerar Serviços Existentes</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Informações da Empresa</CardTitle>
          <CardDescription>Atualize o nome e ícone da empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="company_name">Nome da Empresa</Label>
            <Input
              id="company_name"
              placeholder="Ex: Casa do Ar"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label>Logo da Empresa</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
              {formData.company_logo_url ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <img src={formData.company_logo_url} alt="Logo" className="h-24 w-24 object-contain" />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadLogo}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Baixar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const novo = { ...formData, company_logo_url: '' };
                          setFormData(novo);
                          if (settings?.id) await base44.entities.CompanySettings.update(settings.id, novo).catch(() => {});
                          queryClient.invalidateQueries({ queryKey: ['companySettings'] });
                        }}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <label className="text-xs text-gray-500 cursor-pointer hover:text-gray-600">
                    Alterar imagem
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="flex flex-col items-center py-4">
                    <Upload className="w-6 h-6 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Clique para fazer upload da logo</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG até 5MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Banner para PDFs */}
          <div className="space-y-2">
            <Label>Banner para PDFs e Relatórios</Label>
            <p className="text-xs text-gray-500">Imagem horizontal exibida no topo de todos os documentos gerados (comprovantes, relatórios, comissões). Recomendado: 1000×180 px ou similar.</p>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4">
              {bannerUrl ? (
                <div className="space-y-3">
                  <img src={bannerUrl} alt="Banner" className="w-full h-auto object-contain rounded-lg" />
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-500 cursor-pointer hover:text-gray-600 flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Alterar banner
                      <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remover
                    </button>
                    <span className="text-xs text-emerald-600 font-medium ml-auto">✓ Banner salvo</span>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="flex flex-col items-center py-4">
                    {uploadingBanner ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2" /> : <Upload className="w-6 h-6 text-gray-400 mb-2" />}
                    <p className="text-sm text-gray-600">{uploadingBanner ? 'Enviando e salvando...' : 'Clique para fazer upload do banner'}</p>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG — imagem horizontal (ex: 1000×180 px)</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_icon">Ícone Padrão</Label>
            <Select value={formData.company_icon} onValueChange={(value) => setFormData({ ...formData, company_icon: value })}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LUCIDE_ICONS.map(icon => (
                  <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-2">Usado como fallback se nenhuma logo for carregada</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 h-11"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}