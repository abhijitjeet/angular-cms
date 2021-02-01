import 'reflect-metadata';
import { Validators } from '@angular/forms';

import { ClassOf } from '../types';
import { PROPERTIES_METADATA_KEY, PROPERTY_METADATA_KEY } from './metadata-key';
import { ISelectionFactory } from '../bases/selection-factory';
import { UIHint } from '../types/ui-hint';

export type ValidateMetadata = {
    validateFn: Function;
    message?: string
};

export interface PropertyMetadata {
    displayName?: string;
    description?: string;
    displayType?: string;
    selectionFactory?: ClassOf<ISelectionFactory>;
    /**
     * The type of item in object list
     *
     * Must have a value when the `displayType=UIHint.ObjectList`
     */
    objectListItemType?: ClassOf<any>;
    order?: number;
    groupName?: string;
    validates?: ValidateMetadata[];
    allowedTypes?: string[];
    // be only used as private property for internal methods
    _propertyType?: string;
    [key: string]: any;
}

/**
 * The property decorator factory
 *
 * The factory, is just a function that receives any parameters you want and returns a function with a decorator signature
 *
 * https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-factories
 * @param metadata
 */
export function Property(metadata: PropertyMetadata = {}): PropertyDecorator {
    function propertyDecorator(target: object, propertyKey: string) {
        const properties: string[] = Reflect.getOwnMetadata(PROPERTIES_METADATA_KEY, target.constructor) || [];
        if (properties.indexOf(propertyKey) === -1) { properties.push(propertyKey); }
        Reflect.defineMetadata(PROPERTIES_METADATA_KEY, properties, target.constructor);

        if (!metadata._propertyType) {
            metadata._propertyType = getPropertyType(target, propertyKey);
        }
        if (!metadata.displayType) {
            metadata.displayType = getDefaultDisplayType(metadata._propertyType);
        }
        if (!metadata.displayName) {
            metadata.displayName = propertyKey;
        }

        return Reflect.defineMetadata(PROPERTY_METADATA_KEY, metadata, target.constructor, propertyKey);
    }

    function getPropertyType(target: object, propertyKey: string): string {
        // Obtaining type metadata using the reflect metadata API
        const propertyTypeMetadata = Reflect.getMetadata('design:type', target, propertyKey);
        return propertyTypeMetadata ? propertyTypeMetadata.name : undefined;
    }

    function getDefaultDisplayType(propertyType: string): string {
        if (!propertyType) { return undefined; }
        switch (propertyType.toLowerCase()) {
            case 'string':
                return UIHint.Text;
            case 'boolean':
                return UIHint.Checkbox;
            case 'number':
                return UIHint.Text;
            default:
                return undefined;
        }
    }

    return propertyDecorator;
}

export class ValidationTypes {
    static required(message?: string): ValidateMetadata {
        return { validateFn: Validators.required, message };
    }

    static minLength(value: number, message?: string): ValidateMetadata {
        return { validateFn: Validators.minLength(value), message };
    }

    static maxLength(value: number, message?: string): ValidateMetadata {
        return { validateFn: Validators.maxLength(value), message };
    }
}
