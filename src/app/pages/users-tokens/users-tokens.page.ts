import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
  IonCard, IonCardContent, IonGrid, IonRow, IonCol,
  IonSelect, IonSelectOption, IonSearchbar, IonBadge, IonChip,
  IonSkeletonText, IonLabel, IonItem
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { UserTokenMockService, UserTokenView } from 'src/app/services/user-token.mock.service';

// Navegação / auth
import { Router } from '@angular/router';
import { AuthService } from 'src/app/guard/auth.service';

// Alert/Loading/Toast
import { AlertController, LoadingController, ToastController } from '@ionic/angular/standalone';

// Service da API para criar tokens
import { TokenApiService } from 'src/app/services/token-api.service';

@Component({
  standalone: true,
  selector: 'app-users-tokens',
  imports: [
    IonItem, IonLabel,
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton,
    IonCard, IonCardContent, IonGrid, IonRow, IonCol,
    IonSelect, IonSelectOption, IonSearchbar, IonBadge, IonChip, IonSkeletonText
  ],
  templateUrl: './users-tokens.page.html',
  styleUrls: ['./users-tokens.page.scss']
})
export class UsersTokensPage {
revoke(_t106: UserTokenView) {
throw new Error('Method not implemented.');
}

  // filtros
  period = signal<'Todos'|'7d'|'30d'|'90d'>('Todos');
  status = signal<'Todos'|'Ativo'|'Inativo'>('Todos');
  query = signal<string>('');

  // dados
  loading = signal<boolean>(true);
  rows = signal<UserTokenView[]>([]);

  // paginação simples
  page = signal(1);
  pageSize = 10;
navigator: any;

  constructor(
    private mock: UserTokenMockService,
    private auth: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private tokenApi: TokenApiService,
  ) {
    this.mock.list().subscribe(data => {
      this.rows.set(data);
      this.loading.set(false);
    });

    effect(() => { void this.filtered(); this.page.set(1); });
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
          // nome do campo padronizado
          name: 'expiresIn',
          type: 'number',
          placeholder: 'Validade (minutos)',
          value: '60',
          min: 1,
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
              telefone: (data?.telefone ?? '').trim(), // ✅ string
              expiresIn: minutes,                       // ✅ minutes > 0
              is_active: true,
            };
            if (!dto.nome || !dto.email || !dto.documento || !minutes) {
              this.presentToast('Preencha nome, email, documento e uma validade (minutos) válida (> 0).', 'danger');
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

  // Converte para inteiro seguro (apenas dígitos). Retorna 0 se inválido.
  private parseMinutes(v: any): number {
    const s = (v ?? '').toString().trim().replace(/[^\d]/g, '');
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private async createTokenViaApi(dto: {
    nome: string; email: string; documento: string; telefone: string; // ✅ string
    expiresIn: number; is_active: boolean;
  }) {
    const loading = await this.loadingCtrl.create({ message: 'Gerando...', spinner: 'crescent' });
    await loading.present();

    try {
      const expiresIso = new Date(Date.now() + dto.expiresIn * 60000).toISOString();
      const res = await this.tokenApi.createToken(dto).toPromise();
      const token = this.extractToken(res);
      await loading.dismiss();

      const alert = await this.alertCtrl.create({
        header: 'Token gerado',
        message: 'Copie o token abaixo:',
        cssClass: 'token-alert',
        inputs: [{ name: 'token', type: 'text', value: token, attributes: { readonly: true } }],
        buttons: [
          { text: 'COPIAR', handler: () => { navigator.clipboard?.writeText(token || ''); return false; } },
          { text: 'CONCLUIR', role: 'cancel' }
        ]
      });
      await alert.present();

      setTimeout(() => {
        const inputEl = document.querySelector('ion-alert input') as HTMLInputElement | null;
        inputEl?.focus(); inputEl?.select();
      }, 50);

      const nowIso = new Date().toISOString();

      this.rows.set([{
        id: Date.now(),
        userId: '',
        nome: dto.nome,
        email: dto.email,
        documento: dto.documento,
        telefone: dto.telefone,  // ✅ string
        token,
        createdAt: nowIso,
        expiresAt: expiresIso,
        status: 'Ativo',
      }, ...this.rows()]);

      this.presentToast('Token gerado com sucesso!', 'success');

    } catch (e: any) {
      await loading.dismiss();
      const msg = e?.error?.message || e?.message || 'Falha ao gerar token.';
      this.presentToast(msg, 'danger');
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

  // ====== filtros/lista/paginação ======
  filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    const st = this.status();
    const pd = this.period();

    const inPeriod = (iso: string) => {
      if (pd === 'Todos') return true;
      const days = pd === '7d' ? 7 : pd === '30d' ? 30 : 90;
      const d = new Date(iso).getTime();
      const min = Date.now() - days * 24 * 60 * 60 * 1000;
      return d >= min;
    };

    return this.rows().filter(r => {
      const matchesQ =
        r.nome.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.documento.includes(q) ||
        r.telefone.toLowerCase().includes(q) ||  // ✅ busca correta no telefone
        r.token.includes(q);
      const matchesSt = st === 'Todos' ? true : r.status === st;
      const matchesPd = inPeriod(r.createdAt) || inPeriod(r.expiresAt);
      return matchesQ && matchesSt && matchesPd;
    });
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  badgeColor(st: 'Ativo'|'Inativo') {
    return st === 'Ativo' ? 'success' : 'medium';
  }
}
