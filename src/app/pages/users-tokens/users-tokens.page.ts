import { Component, computed, effect, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonCard, IonCardContent, IonGrid, IonRow, IonCol,
  IonSelect, IonSelectOption, IonSearchbar, IonBadge, IonChip,
  IonSkeletonText, IonLabel, IonItem, IonSegment, IonSegmentButton } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { UserTokenMockService, UserTokenView } from 'src/app/services/user-token.mock.service';

// Navegação / auth
import { Router } from '@angular/router';
import { AuthService } from 'src/app/guard/auth.service';

// Alert/Loading/Toast
import { AlertController, LoadingController, ToastController } from '@ionic/angular/standalone';

// Service da API
import { TokenApiService, TokenRow } from 'src/app/services/token-api.service';
import { Title } from '@angular/platform-browser';

type TokenViewWithQtd = UserTokenView & { qtd?: number };

@Component({
  standalone: true,
  selector: 'app-users-tokens',
  imports: [IonSegmentButton, IonSegment, 
    IonItem, IonLabel,
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonCard, IonCardContent, IonGrid, IonRow, IonCol,
    IonSelect, IonSelectOption, IonSearchbar, IonBadge, IonChip, IonSkeletonText
  ],
  templateUrl: './users-tokens.page.html',
  styleUrls: ['./users-tokens.page.scss']
})
export class UsersTokensPage implements OnInit {

  engine = signal<string>('ITI');  // Valor padrão para o modo, agora usando 'engine'
selectedMode: any;

  async ngOnInit() {
    // Carrega o valor do local storage ao iniciar a página
    const storedEngine = localStorage.getItem('engine');
    if (storedEngine === 'ITI' || storedEngine === 'SDK') {
      this.engine.set(storedEngine);
    } else {
      // Se não existir, usa o padrão 'ITI'
      this.engine.set('ITI');
      localStorage.setItem('engine', this.engine());
    }

    this.titleSvc.setTitle('ValidaDocs');
    this.fetchFromApi();
    effect(() => { void this.filtered(); this.page.set(1); });
  }

  async refresh(): Promise<void> {
    await this.fetchFromApi();
  }

  // filtros
  period = signal<'Todos'|'7d'|'30d'|'90d'>('Todos');
  status  = signal<'Todos'|'Ativo'|'Inativo'>('Todos');
  query   = signal<string>('');

  // dados
  loading = signal<boolean>(true);
  rows    = signal<TokenViewWithQtd[]>([]);

  // paginação simples
  page = signal(1);
  pageSize = 10;

  constructor(
    private mock: UserTokenMockService,
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private tokenApi: TokenApiService,
    private titleSvc: Title,
  ) {}

  onSegmentChange(event: any) {
    const newEngine = event.detail.value;  // 'ITI' ou 'SDK'
    this.engine.set(newEngine);
    localStorage.setItem('engine', newEngine);  // Agora salva na chave 'engine'
    console.log('Engine alterado para:', newEngine);
    // Opcional: Adicione lógica aqui para recarregar dados ou mudar o comportamento
  }

  private async fetchFromApi(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.tokenApi.listTokens().toPromise();
      const mapped = (list ?? []).map(r => this.mapApiRowToView(r));

      // ordena por createdAt desc
      mapped.sort(
        (a, b) =>
          (new Date(b.createdAt as any).getTime() || 0) -
          (new Date(a.createdAt as any).getTime() || 0)
      );

      this.rows.set(mapped);
    } catch {
      // fallback opcional: mock (também ordenado)
      this.mock.list().subscribe(data => {
        const sorted = [...data].sort(
          (a, b) =>
            (new Date(b.createdAt as any).getTime() || 0) -
            (new Date(a.createdAt as any).getTime() || 0)
        );
        // garante 'qtd'
        this.rows.set(sorted.map(x => ({ ...x, qtd: (x as any)?.qtd ?? 0 })));
      });
      this.presentToast('Falha ao carregar lista do servidor. Exibindo mock.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  private mapApiRowToView(r: TokenRow): TokenViewWithQtd {
    const now = Date.now();
    const activeByTime = !r.expires_at ? true : new Date(r.expires_at).getTime() > now;
    const active = (r.is_active ?? true) && activeByTime;

    return {
      id: r.id,
      userId: r.user_id,
      nome: r.nome,
      email: r.email,
      documento: r.documento,
      telefone: (r.telefone ?? '').toString(),
      token: r.token,
      createdAt: r.created_at,
      expiresAt: r.expires_at ?? '',
      status: active ? 'Ativo' : 'Inativo',
      qtd: (r as any)?.validation_count ?? 0,
    };
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/home']);
  }

  async openGenerateToken() {
    const alert = await this.alertCtrl.create({
      header: 'Gerar Token',
      message: 'Preencha os dados para criar o token.',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [
        { name: 'nome', type: 'text', placeholder: 'Nome', attributes: { maxlength: 80 } },
        { name: 'email', type: 'email', placeholder: 'Email', attributes: { maxlength: 120 } },
        { name: 'documento', type: 'text', placeholder: 'CPF/CNPJ', attributes: { maxlength: 20 } },
        { name: 'telefone', type: 'text', placeholder: 'Telefone', attributes: { maxlength: 20 } },
        {
          name: 'expiresIn',
          type: 'number',
          placeholder: 'Validade (minutos)',
          value: '60',
          min: 0,
          attributes: { inputmode: 'numeric', pattern: '[0-9]*', step: 1 }
        },
      ],
      buttons: [
        { text: 'CANCELAR', role: 'cancel' },
        {
          text: 'GERAR',
          handler: (data: any) => {
            const minutes = this.parseMinutes(data?.expiresIn);
            const dto = {
              nome: (data?.nome ?? '').trim(),
              email: (data?.email ?? '').trim(),
              documento: (data?.documento ?? '').trim(),
              telefone: (data?.telefone ?? '').trim(),
              expiresIn: minutes,
              is_active: true,
            };
            if (!dto.nome || !dto.email || !Number.isFinite(minutes) || minutes < 0) {
              this.presentToast('Preencha nome, email e uma validade (minutos) >= 0.', 'danger');
              return false;
            }
            this.createTokenViaApi(dto);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private parseMinutes(v: any): number {
    const s = (v ?? '').toString().trim().replace(/[^\d]/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  private async createTokenViaApi(dto: {
    nome: string; email: string; documento: string; telefone: string;
    expiresIn: number; is_active: boolean;
  }) {
    const loading = await this.loadingCtrl.create({ message: 'Gerando...', spinner: 'crescent' });
    await loading.present();
    try {
      const expiresIso = dto.expiresIn > 0 ? new Date(Date.now() + dto.expiresIn * 60000).toISOString() : '';
      const res = await this.tokenApi.createToken(dto).toPromise();
      const token = this.extractToken(res);
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Token gerado',
        message: 'Copie o token abaixo:',
        inputs: [{ name: 'token', type: 'text', value: token, attributes: { readonly: true } }],
        buttons: [
          { text: 'COPIAR', handler: () => { window.navigator?.clipboard?.writeText(token || ''); return false; } },
          { text: 'CONCLUIR', role: 'cancel' }
        ]
      });
      await alert.present();
      setTimeout(() => {
        const inputEl = document.querySelector('ion-alert input') as HTMLInputElement | null;
        inputEl?.focus(); inputEl?.select();
      }, 50);
      const nowIso = new Date().toISOString();
      const active = dto.expiresIn === 0 ? true : new Date(expiresIso).getTime() > Date.now();
      this.rows.set([{
        id: Date.now(),
        userId: '',
        nome: dto.nome,
        email: dto.email,
        documento: dto.documento,
        telefone: dto.telefone,
        token,
        createdAt: nowIso,
        expiresAt: expiresIso,
        status: active ? 'Ativo' : 'Inativo',
        qtd: 0,
      }, ...this.rows()]);
      this.presentToast('Token gerado com sucesso!', 'success');
    } catch (e: any) {
      await loading.dismiss();
      this.presentToast(e?.error?.message || e?.message || 'Falha ao gerar token.', 'danger');
    }
  }

  private extractToken(res: any): string {
    try {
      if (typeof res === 'string') {
        const s = res.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
          const obj = JSON.parse(s);
          return obj?.token ?? obj?.data?.token ?? obj?.credential?.token ?? obj?.result?.token ?? obj?.access_token ?? '';
        }
        return s;
      }
      return res?.token ?? res?.data?.token ?? res?.credential?.token ?? res?.result?.token ?? res?.access_token ?? '';
    } catch {
      return '';
    }
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'tertiary' = 'tertiary') {
    const t = await this.toastCtrl.create({ message, duration: 2500, color });
    t.present();
  }

  copy(token: string) {
    window.navigator?.clipboard?.writeText(token || '');
    this.presentToast('Token copiado.', 'tertiary');
  }

  async revoke(row: TokenViewWithQtd) {
    const cleanName = this.collapseTrailingRepeats(row.nome);
    const safeName = this.escapeText(cleanName);
    const alert = await this.alertCtrl.create({
      header: 'Revogar token',
      subHeader: safeName,
      message: 'Deseja revogar este token?',
      buttons: [
        { text: 'CANCELAR', role: 'cancel' },
        {
          text: 'REVOGAR',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Revogando...' });
            await loading.present();
            try {
              await this.tokenApi.revokeByToken(row.token).toPromise();
              this.rows.set(this.rows().map(r => r.id === row.id ? { ...r, status: 'Inativo' } : r));
              this.presentToast('Token revogado.', 'success');
            } catch (e: any) {
              this.presentToast(e?.error?.message || e?.message || 'Falha ao revogar token.', 'danger');
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private escapeText(v: string): string {
    return (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private collapseTrailingRepeats(full: string): string {
    let s = (full || '').replace(/\s+/g, ' ').trim();
    if (!s) return s;
    const words = s.split(' ');
    for (let size = 4; size >= 1; size--) {
      if (words.length < size * 2) continue;
      const tail = words.slice(-size).join(' ');
      const twice = new RegExp(`(?:\\s*${this.escapeRegExp(tail)}){2,}$`);
      if (twice.test(s)) {
        s = s.replace(twice, ' ' + tail).trim();
        break;
      }
    }
    return s;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  filtered = computed(() => {
    const q = (this.query() || '').toLowerCase().trim();
    const st = this.status();
    const pd = this.period();
    const inPeriod = (iso: string) => {
      if (!iso) return false;
      if (pd === 'Todos') return true;
      const days = pd === '7d' ? 7 : pd === '30d' ? 30 : 90;
      const t = new Date(iso as any).getTime();
      const min = Date.now() - days * 24 * 60 * 60 * 1000;
      return t >= min;
    };
    return this.rows().filter(r => {
      const matchesQ = r.nome.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.documento.includes(q) || (r.telefone || '').toLowerCase().includes(q) || r.token.includes(q);
      const matchesSt = st === 'Todos' ? true : r.status === st;
      const matchesPd = inPeriod(r.createdAt) || inPeriod(r.expiresAt);
      return matchesQ && matchesSt && matchesPd;
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));

  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  badgeColor(st: 'Ativo'|'Inativo') {
    return st === 'Ativo' ? 'success' : 'medium';
  }
}
