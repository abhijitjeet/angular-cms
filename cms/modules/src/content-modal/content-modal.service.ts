import { ContentReference, CmsImage } from '@angular-cms/core';
import { Injectable } from '@angular/core';
import { BsModalService, ModalOptions } from 'ngx-bootstrap/modal';
import { Observable } from 'rxjs';

import { MediaTreeModalComponent } from './media-modal.component';
import { PageTreeModalComponent } from './page-modal.component';

@Injectable()
export class ContentModalService {

    constructor(private modalService: BsModalService) { }

    openPageDialog(selectedContentId: string): Observable<ContentReference> {
        const config: ModalOptions = {
            initialState: { selectedContentId },
            animated: false,
            class: 'modal-md'
        }

        const modalRef = this.modalService.show(PageTreeModalComponent, config);

        return modalRef.content.getResult();
    }

    openMediaDialog(selectedContentId: string): Observable<CmsImage & ContentReference> {
        const config: ModalOptions = {
            initialState: { selectedContentId },
            animated: false,
            class: 'modal-lg'
        }

        const modalRef = this.modalService.show(MediaTreeModalComponent, config);

        return modalRef.content.getResult();
    }
}
