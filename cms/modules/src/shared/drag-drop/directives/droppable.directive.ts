import { Directive, ElementRef, HostListener, Input, Output, EventEmitter, OnInit, OnDestroy, Renderer2, NgZone } from '@angular/core';

import { Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { DropEvent } from '../drop-event.model';
import { DndService } from '../dnd.service';

@Directive({
    selector: '[droppable]'
})
export class Droppable implements OnInit, OnDestroy {

    /**
     *  Event fired when Drag dragged element enters a valid drop target.
     */
    // tslint:disable-next-line: no-output-on-prefix
    @Output() onDragEnter: EventEmitter<any> = new EventEmitter();

    /**
     * Event fired when an element is being dragged over a valid drop target
     */
    // tslint:disable-next-line: no-output-on-prefix
    @Output() onDragOver: EventEmitter<any> = new EventEmitter();

    /**
     * Event fired when a dragged element leaves a valid drop target.
     */
    // tslint:disable-next-line: no-output-on-prefix
    @Output() onDragLeave: EventEmitter<any> = new EventEmitter();

    /**
     * Event fired when an element is dropped on a valid drop target.
     */
    // tslint:disable-next-line: no-output-on-prefix
    @Output() onDrop: EventEmitter<DropEvent> = new EventEmitter();

    /**
     * CSS class that is applied when a compatible draggable is being dragged over this droppable.
     */
    @Input() dragOverClass = 'drag-over-border';

    /**
     * CSS class applied on this droppable when a compatible draggable item is being dragged.
     * This can be used to visually show allowed drop zones.
     */
    @Input() dragHintClass = 'drag-hint-border';

    /**
     * Defines compatible drag drop pairs. Values must match both in draggable and droppable.dropScope.
     */
    @Input() dropScope: string | string[] | Function = 'default';

    /**
     * Defines if drop is enabled. `true` by default.
     */
    @Input()
    get dropEnabled() {
        return this._dropEnabled;
    }
    set dropEnabled(value: boolean) {
        this._dropEnabled = value;

        if (this._dropEnabled === true) {
            this.subscribeService();
        } else {
            this.unsubscribeService();
        }
    }

    /**
     *
     */
    private dragStartSubscription: Subscription;

    /**
     *
     */
    private dragEndSubscription: Subscription;

    /**
     * Backing field for the dropEnabled property
     */
    private _dropEnabled = true;

    /**
     * Field for tracking drag state. Helps when
     * drag stop event occurs before the allowDrop()
     * can be calculated (async).
     */
    private _isDragActive = false;

    /**
     * Field for tracking if service is subscribed.
     * Avoids creating multiple subscriptions of service.
     */
    private _isServiceActive = false;

    /**
     * Function for unbinding the drag enter listener
     */
    private unbindDragEnterListener: Function;

    /**
     * Function for unbinding the drag over listener
     */
    private unbindDragOverListener: Function;

    /**
     * Function for unbinding the drag leave listener
     */
    private unbindDragLeaveListener: Function;

    placeholder: any;

    constructor(protected el: ElementRef, private renderer: Renderer2,
        private dndService: DndService, private zone: NgZone) {
    }

    ngOnInit() {
        if (this.dropEnabled === true) {
            this.subscribeService();
        }
    }

    ngOnDestroy() {
        this.unsubscribeService();
        this.unbindDragListeners();
    }

    setDragPlaceholder(placeholderElement: ElementRef) {
        this.placeholder = placeholderElement ? placeholderElement.nativeElement : this.createDefaultDragPlaceHolder();
    }

    private createDefaultDragPlaceHolder(): any {
        const defaultPlaceHolder = this.renderer.createElement('div');
        this.renderer.addClass(defaultPlaceHolder, 'drag-placeholder');
        return defaultPlaceHolder;
    }

    private getPlaceholderIndex() {
        if (!this.el.nativeElement.children) { return 0; }
        if (!this.placeholder) { return this.el.nativeElement.children.length; }

        return Array.prototype.indexOf.call(this.el.nativeElement.children, this.placeholder);
    }

    private insertDropPlaceholder(event) {
        if (!this.placeholder) { return; }

        event = event.originalEvent || event;
        const listNode = this.el.nativeElement;

        // Make sure the placeholder is shown, which is especially important if the list is empty.
        if (this.placeholder.parentNode != listNode) {
            listNode.appendChild(this.placeholder);
        }

        if (event.target != listNode) {
            // Try to find the node direct directly below the list node.
            let listItemNode = event.target;
            while (listItemNode.parentNode != listNode && listItemNode.parentNode) {
                listItemNode = listItemNode.parentNode;
            }

            if (listItemNode.parentNode == listNode && listItemNode != this.placeholder) {
                // If the mouse pointer is in the upper half of the list item element,
                // we position the placeholder before the list item, otherwise after it.
                const rect = listItemNode.getBoundingClientRect();
                const isFirstHalf = event.clientY < rect.top + rect.height / 2;
                listNode.insertBefore(this.placeholder, isFirstHalf ? listItemNode : listItemNode.nextSibling);
            }
        }
    }

    private removeDropPlaceholder(event) {
        event = event.originalEvent || event;
        const listNode = this.el.nativeElement;

        const newTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (listNode.contains(newTarget) && !event._dndPhShown) {
            // Signalize to potential parent lists that a placeholder is already shown.
            event._dndPhShown = true;
        } else if (this.placeholder) {
            this.placeholder.remove();
        }
    }

    dragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        this.onDragEnter.emit(e);
    }

    dragOver(e, result) {
        if (result) {
            this.renderer.addClass(this.el.nativeElement, this.dragOverClass);
            this.insertDropPlaceholder(e);
            e.preventDefault();
            this.onDragOver.emit(e);
        }
    }

    dragLeave(e) {
        this.renderer.removeClass(this.el.nativeElement, this.dragOverClass);
        this.removeDropPlaceholder(e);
        e.preventDefault();
        this.onDragLeave.emit(e);
    }

    @HostListener('drop', ['$event'])
    drop(e) {
        this.allowDrop().subscribe(result => {
            if (result && this._isDragActive) {
                this.renderer.removeClass(this.el.nativeElement, this.dragOverClass);
                e.preventDefault();
                e.stopPropagation();

                this.dndService.dragEnd$.next();
                this.onDrop.emit(new DropEvent(e, this.dndService.dragData, this.getPlaceholderIndex()));
                this.dndService.dragData = null;
                this.dndService.scope = null;
                if (this.placeholder) { this.placeholder.remove(); }
            }
        });
    }

    allowDrop(): Observable<boolean> {
        // let allowed: boolean | Observable<boolean> = false;
        let allowed: any = false;

        /* tslint:disable:curly */
        /* tslint:disable:one-line */
        if (typeof this.dropScope === 'string') {
            if (typeof this.dndService.scope === 'string')
                allowed = this.dndService.scope === this.dropScope;
            else if (this.dndService.scope instanceof Array)
                allowed = this.dndService.scope.indexOf(this.dropScope) > -1;
        } else if (this.dropScope instanceof Array) {
            if (typeof this.dndService.scope === 'string')
                allowed = this.dropScope.indexOf(this.dndService.scope) > -1;
            else if (this.dndService.scope instanceof Array)
                allowed = this.dropScope.filter(item => {
                    return this.dndService.scope.indexOf(item) !== -1;
                }).length > 0;
        } else if (typeof this.dropScope === 'function') {
            allowed = this.dropScope(this.dndService.dragData);
            if (allowed instanceof Observable) {
                return allowed.pipe(map(result => result && this.dropEnabled));
            }
        }

        return of(allowed && this.dropEnabled);
    }

    subscribeService() {
        if (this._isServiceActive === true) {
            return;
        }
        this._isServiceActive = true;
        this.dragStartSubscription = this.dndService.dragStart$.subscribe(() => {
            this._isDragActive = true;
            this.allowDrop().subscribe(result => {
                if (result && this._isDragActive) {
                    this.renderer.addClass(this.el.nativeElement, this.dragHintClass);

                    this.zone.runOutsideAngular(() => {
                        this.unbindDragEnterListener = this.renderer.listen(this.el.nativeElement, 'dragenter', (dragEvent) => {
                            this.dragEnter(dragEvent);
                        });
                        this.unbindDragOverListener = this.renderer.listen(this.el.nativeElement, 'dragover', (dragEvent) => {
                            this.dragOver(dragEvent, result);
                        });
                        this.unbindDragLeaveListener = this.renderer.listen(this.el.nativeElement, 'dragleave', (dragEvent) => {
                            this.dragLeave(dragEvent);
                        });
                    });
                }
            });
        });

        this.dragEndSubscription = this.dndService.dragEnd$.subscribe(() => {
            this._isDragActive = false;
            this.renderer.removeClass(this.el.nativeElement, this.dragHintClass);
            this.unbindDragListeners();
        });
    }

    unsubscribeService() {
        this._isServiceActive = false;
        if (this.dragStartSubscription) {
            this.dragStartSubscription.unsubscribe();
        }
        if (this.dragEndSubscription) {
            this.dragEndSubscription.unsubscribe();
        }
    }

    unbindDragListeners() {
        if (this.unbindDragEnterListener) {
            this.unbindDragEnterListener();
        }
        if (this.unbindDragOverListener) {
            this.unbindDragOverListener();
        }
        if (this.unbindDragLeaveListener) {
            this.unbindDragLeaveListener();
        }
    }
}

