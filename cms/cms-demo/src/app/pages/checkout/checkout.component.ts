import { CmsComponent, PageService } from '@angular-cms/core';
import { Component } from '@angular/core';
import { CheckoutPage } from './checkout.pagetype';

@Component({
    templateUrl: 'checkout.component.html'
})
export class CheckoutComponent extends CmsComponent<CheckoutPage> {
    constructor(private contentService: PageService) {
        super();
    }
}
