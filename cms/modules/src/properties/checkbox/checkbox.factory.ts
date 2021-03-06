import { Injectable, Injector } from '@angular/core';

import { CmsPropertyFactory, UIHint } from '@angular-cms/core';
import { CheckboxProperty } from './checkbox.property';

@Injectable()
export class CheckboxPropertyFactory extends CmsPropertyFactory {
    constructor(injector: Injector) {
        super(injector, UIHint.Checkbox, CheckboxProperty);
    }
}
