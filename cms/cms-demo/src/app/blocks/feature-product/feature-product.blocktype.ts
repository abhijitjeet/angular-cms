import { BlockData, BlockType, Property, ValidationTypes, UIHint } from '@angular-cms/core';
import { FeatureProductsComponent } from './feature-products.component';

@BlockType({
    displayName: 'Feature Products Block',
    componentRef: FeatureProductsComponent
})
export class FeatureProductsBlock extends BlockData {
    @Property({
        displayName: 'Heading',
        displayType: UIHint.Text
    })
    heading: string;

    @Property({
        displayName: 'Subheading',
        displayType: UIHint.Text
    })
    subheading: string;

    @Property({
        displayName: 'Description',
        displayType: UIHint.XHtml
    })
    description: string;

    @Property({
        displayName: 'Testimony Items',
        displayType: UIHint.ContentArea
    })
    products: any[];
}
