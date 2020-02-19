import { ModuleWithProviders, PLATFORM_ID } from '@angular/core';
import { EVENT_MANAGER_PLUGINS } from '@angular/platform-browser';
import { RouteReuseStrategy, Routes } from '@angular/router';
import * as CMS from './cms';

import { CmsModuleConfig } from './constants/module-config';
import { CoreModule } from "./core.module";
import { CmsRenderContentComponent } from './render/cms-content';
import { locationFactory, WINDOW_LOCATION } from './services/browser-location.service';
import { localStorageFactory, LOCAL_STORAGE } from './services/browser-storage.service';
import { OutsideZoneEventPlugin } from './utils/outside-zone-event-plugin';
import { CustomRouteReuseStrategy } from './utils/route-reuse-strategy';


// Reexport all public apis
export class AngularCmsModule {
    public static forRoot(): ModuleWithProviders {
        return {
            ngModule: CoreModule,
            providers: [
                {
                    provide: EVENT_MANAGER_PLUGINS,
                    useClass: OutsideZoneEventPlugin,
                    multi: true
                },
                {
                    provide: RouteReuseStrategy,
                    useClass: CustomRouteReuseStrategy
                },
                {
                    provide: WINDOW_LOCATION,
                    useFactory: locationFactory,
                    deps: [PLATFORM_ID]
                },
                {
                    provide: LOCAL_STORAGE,
                    useFactory: localStorageFactory,
                    deps: [PLATFORM_ID]
                }
            ]
        };
    }

    public static registerCmsRoutes(layoutComponent): Routes {
        const cmsRoutes: Routes = [
            {
                path: '',
                component: layoutComponent,
                children: [
                    {
                        path: '**',
                        data: { reuse: false }, //pass reuse param to CustomRouteReuseStrategy
                        component: CmsRenderContentComponent,
                    }
                ]
            }
        ];

        return cmsRoutes;
    }

    public static registerContentTypes(theEntryScope: any) {
        CMS.registerContentTypes(theEntryScope);
    }

    public static registerProperty(property: any, uniqueAccessKey?: string) {
        CMS.registerProperty(property, uniqueAccessKey);
    }

    public static registerProperties(properties: Array<[string, Function]> | Array<Function>) {
        CMS.registerProperties(properties);
    }

    public static registerModule(moduleConfig: CmsModuleConfig) {
        CMS.registerModule(moduleConfig);
    }
}