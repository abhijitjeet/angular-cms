import { Block, BlockService, BLOCK_TYPE } from '@angular-cms/core';
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, merge, Observable, Subject } from 'rxjs';
import { distinctUntilKeyChanged, map, switchMap, takeUntil, takeWhile, tap } from 'rxjs/operators';
import { CmsModalService } from '../shared/modal/modal.service';
import { SubjectService } from '../shared/services/subject.service';
import { SubscriptionDestroy } from '../shared/subscription-destroy';
import { TreeComponent } from '../shared/tree/components/tree.component';
import { TreeConfig } from '../shared/tree/interfaces/tree-config';
import { NodeMenuItemAction, TreeMenuActionEvent } from '../shared/tree/interfaces/tree-menu';
// import { TreeNode, TreeComponent, TreeConfig, NodeMenuItemAction, TreeMenuActionEvent } from '../shared/tree';
import { TreeNode } from '../shared/tree/interfaces/tree-node';
import { TreeService } from '../shared/tree/interfaces/tree-service';
import { BlockTreeService } from './block-tree.service';


const BLOCK_MENU_ACTION = {
    DeleteFolder: 'DeleteFolder',
    NewBlock: 'NewBlock'
};

@Component({
    template: `
    <as-split direction="vertical" gutterSize="4">
        <as-split-area size="50">
            <div class="position-relative">
                <cms-tree
                    class="tree-root pl-1 pt-2 d-block"
                    [root]="root"
                    [config]="treeConfig"
                    (nodeSelected)="folderSelected$.next($event)"
                    (nodeInlineCreated)="createBlockFolder($event)"
                    (nodeInlineUpdated)="updateBlockFolder($event)"
                    (menuItemSelected)="menuItemSelected($event)">
                    <ng-template #treeNodeTemplate let-node>
                        <span [ngClass]="{'block-node': node.id != '0', 'border-bottom': node.isSelected && node.id != '0'}">
                            <fa-icon class="mr-1" *ngIf="node.id == '0'" [icon]="['fas', 'cubes']"></fa-icon>
                            <fa-icon class="mr-1" *ngIf="node.id != '0'" [icon]="['fas', 'folder']"></fa-icon>
                            <span class="node-name">{{node.name}}</span>

                        </span>
                    </ng-template>
                </cms-tree>
                <div class='toolbar mt-2 mr-1'>
                    <button type="button"
                        class="btn btn-xs btn-secondary float-right mr-1"
                        (click)="clickToCreateFolder(root)">
                        <fa-icon [icon]="['fas', 'folder-plus']"></fa-icon>
                    </button>
                    <a role="button"
                        class="btn btn-xs btn-secondary mr-1 float-right"
                        href="javascript:void(0)"
                        [routerLink]="['new/block']">
                        <fa-icon [icon]="['fas', 'plus']"></fa-icon>
                    </a>
                </div>
            </div>

        </as-split-area>
        <as-split-area size="50">
            <div class="list-group list-block" *ngIf="blocks$ |async as blocks">
                <a *ngFor="let block of blocks"
                    [draggable]
                    [dragData]="block"
                    href="javascript:void(0)"
                    class="list-group-item list-group-item-action p-2">
                    <div class="d-flex align-items-center">
                        <fa-icon class="mr-1" [icon]="['fas', 'cube']"></fa-icon>
                        <div class="w-100 mr-2 text-truncate" [routerLink]="['content/block', block._id]">{{block.name}}</div>
                        <div class="hover-menu ml-auto" dropdown container="body">
                            <fa-icon class="mr-1" [icon]="['fas', 'bars']" dropdownToggle></fa-icon>
                            <div class="cms-dropdown-menu dropdown-menu dropdown-menu-right"
                                *dropdownMenu
                                aria-labelledby="simple-dropdown">
                                <a class="dropdown-item p-2" href="javascript:void(0)" [routerLink]="['content/block', block._id]">
                                    Edit
                                </a>
                                <a class="dropdown-item p-2" href="javascript:void(0)">
                                    Delete
                                </a>
                            </div>
                        </div>
                    </div>
                </a>
            </div>
        </as-split-area>
    </as-split>
        `,
    styleUrls: ['./block-tree.scss'],
    providers: [BlockTreeService, { provide: TreeService, useExisting: BlockTreeService }]
})
export class BlockTreeComponent extends SubscriptionDestroy implements OnInit {
    @ViewChild(TreeComponent) cmsTree: TreeComponent;

    folderSelected$: BehaviorSubject<Partial<TreeNode>>;
    refreshFolder$: Subject<Partial<TreeNode>>;
    blocks$: Observable<Block[]>;

    root: TreeNode;
    selectedFolder: Partial<TreeNode>;
    treeConfig: TreeConfig;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private modalService: CmsModalService,
        private blockService: BlockService,
        private subjectService: SubjectService) {
        super();
        this.root = new TreeNode({ id: '0', name: 'Block', hasChildren: true });
        this.selectedFolder = this.root;
        this.treeConfig = this.initTreeConfiguration();

        this.folderSelected$ = new BehaviorSubject<Partial<TreeNode>>(this.root);
        this.refreshFolder$ = new Subject<Partial<TreeNode>>();
    }

    ngOnInit() {
        this.subjectService.blockFolderCreated$
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(createdFolder => {
                this.cmsTree.setSelectedNode({ id: createdFolder._id, isNeedToScroll: true });
                this.cmsTree.reloadSubTree(createdFolder.parentId);
            });

        this.subjectService.blockCreated$
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe(createdBlock => {
                this.cmsTree.setSelectedNode({ id: createdBlock.parentId });
                // Reload current node
                if (this.selectedFolder.id === createdBlock.parentId) { this.refreshFolder$.next(this.selectedFolder); }
            });

        const setFolderSelected$ = this.folderSelected$.pipe(
            distinctUntilKeyChanged('id'),
            tap(node => this.selectedFolder = node)
        );

        this.blocks$ = merge(setFolderSelected$, this.refreshFolder$).pipe(
            switchMap(node => this.blockService.getContentInFolder(node.id)),
            map((blocks: Block[]) => blocks.map(block => Object.assign(block, {
                type: BLOCK_TYPE,
                contentType: block.contentType,
                isPublished: block.isPublished
            })))
        );
    }

    clickToCreateFolder(node: TreeNode) {
        this.cmsTree.handleNodeMenuItemSelected({ action: NodeMenuItemAction.NewNodeInline, node });
    }

    createBlockFolder(node: TreeNode) {
        this.blockService.createFolder({ name: node.name, parentId: node.parentId })
            .subscribe(folder => {
                this.subjectService.fireBlockFolderCreated(folder);
            });
    }

    updateBlockFolder(node: TreeNode) {
        this.blockService.editFolder({ name: node.name, _id: node.id })
            .subscribe();
    }

    menuItemSelected(nodeAction: TreeMenuActionEvent) {
        const { action, node } = nodeAction;
        switch (action) {
            case BLOCK_MENU_ACTION.NewBlock:
                this.blockCreated(node);
                break;
            case BLOCK_MENU_ACTION.DeleteFolder:
                this.folderDelete(node);
                break;
        }
    }

    private blockCreated(parentNode) {
        this.router.navigate(['new/block', parentNode.id], { relativeTo: this.route });
    }

    private folderDelete(nodeToDelete: TreeNode) {
        if (nodeToDelete.id === '0') { return; }

        this.modalService.confirm(`Delete ${nodeToDelete.name}`, `Do you want to delete the folder ${nodeToDelete.name}?`).pipe(
            takeWhile(confirm => confirm),
        ).subscribe(() => {
            this.blockService.moveContentToTrash(nodeToDelete.id).subscribe(folderToDelete => {
                if (folderToDelete.isDeleted) {
                    // if the deleted node is selected then need to set the parent node is the new selected node
                    if (nodeToDelete.isSelected) this.cmsTree.setSelectedNode({ id: folderToDelete.parentId, isNeedToScroll: true });
                    this.cmsTree.reloadSubTree(folderToDelete.parentId);
                }
            });
        })
    }

    private initTreeConfiguration(): TreeConfig {
        return {
            menuItems: [
                {
                    action: BLOCK_MENU_ACTION.NewBlock,
                    name: 'New Block'
                },
                {
                    action: NodeMenuItemAction.NewNodeInline,
                    name: 'New Folder'
                },
                {
                    action: NodeMenuItemAction.EditNowInline,
                    name: 'Rename'
                },
                {
                    action: NodeMenuItemAction.Copy,
                    name: 'Copy'
                },
                {
                    action: NodeMenuItemAction.Paste,
                    name: 'Paste'
                },
                {
                    action: BLOCK_MENU_ACTION.DeleteFolder,
                    name: 'Delete'
                },
            ]
        };
    }
}
