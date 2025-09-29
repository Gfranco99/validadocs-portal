import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TokenModalComponent } from './token-modal.component';

@NgModule({
  declarations: [TokenModalComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  exports: [TokenModalComponent]
})
export class TokenModalModule {}
