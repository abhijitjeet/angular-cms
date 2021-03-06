import { ContentLoader, PageData, SiteDefinition } from '@angular-cms/core';
import { DOCUMENT } from '@angular/common';
import { Component, ViewEncapsulation, OnInit, AfterViewInit, Renderer2, Inject } from '@angular/core';
import { Observable } from 'rxjs';
import { publishReplay, refCount, switchMap } from 'rxjs/operators';

import { HomePage } from '../../pages/home/home.pagetype';

@Component({
    templateUrl: './layout.component.html',
    styleUrls: ['./layout.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class LayoutComponent implements OnInit, AfterViewInit {
    startPage$: Observable<HomePage>;
    menuItems$: Observable<PageData[]>;

    constructor(
        private siteDefinition: SiteDefinition,
        private contentLoader: ContentLoader,
        private renderer: Renderer2,
        @Inject(DOCUMENT) private document: Document) { }

    ngOnInit() {
        this.startPage$ = this.siteDefinition.getStartPage<HomePage>();
        this.menuItems$ = this.startPage$.pipe(
            switchMap((startPage: HomePage) => this.contentLoader.getChildren<PageData>(startPage.contentLink, { language: startPage.language }))
        );
    }

    ngAfterViewInit(): void {
        const script = this.renderer.createElement('script');
        script.type = 'text/javascript';
        script.src = 'assets/js/layout.js';
        this.renderer.appendChild(this.document.body, script);
    }
}
