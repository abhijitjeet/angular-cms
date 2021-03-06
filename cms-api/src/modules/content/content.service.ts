import { FilterQuery } from 'mongoose';
import { DocumentNotFoundException } from '../../error';
import { pick } from '../../utils';
import { Validator } from '../../validation/validator';
import { FolderService } from '../folder/folder.service';
import { PaginateOptions, PaginateResult, QueryOptions } from '../shared/base.model';
import { ContentLanguageService } from './content-language.service';
import { ContentVersionService } from './content-version.service';
import {
    IContentDocument,
    IContentLanguageDocument,
    IContentLanguageModel, IContentModel, IContentVersionDocument,
    IContentVersionModel
} from './content.model';
import { VersionStatus } from "./version-status";

export class ContentService<T extends IContentDocument, P extends IContentLanguageDocument, V extends IContentVersionDocument> extends FolderService<T, P> {
    protected contentLanguageService: ContentLanguageService<P>;
    protected contentVersionService: ContentVersionService<V>;

    constructor(contentModel: IContentModel<T>, protected contentLanguageModel: IContentLanguageModel<P>, contentVersionModel: IContentVersionModel<V>) {
        super(contentModel, contentLanguageModel);
        this.contentLanguageService = new ContentLanguageService<P>(contentLanguageModel);
        this.contentVersionService = new ContentVersionService<V>(contentVersionModel);
    }

    /**
     * Get content version detail 
     * 
     * If the version Id is not provided, the primary version based on language will be used instead
     * @param id (`Required`) The content's id
     * @param versionId (`Required` but null is allowed)  the version id, if value is null, the primary version based on language will be used
     * @param language (`Required`) The language code (ex 'en', 'de'...)
     * 
     */
    async getContentVersion(id: string, versionId: string, language: string, host?: string): Promise<T & V> {
        Validator.throwIfNullOrEmpty('contentId', id);
        Validator.throwIfNullOrEmpty('language', language);

        const currentContent = await this.findOne({ _id: id, isDeleted: false } as any, { lean: true }).exec();
        Validator.throwIfNotFound('Content', currentContent, { _id: id, isDeleted: false });

        const query: any = versionId ? { _id: versionId, contentId: id } : { isPrimary: true, contentId: id, language };

        const currentVersion = await this.contentVersionService.findOne(query, { lean: true })
            .populate({
                path: 'childItems.content',
                match: { isDeleted: false },
                populate: {
                    path: 'contentLanguages',
                    match: { language: language }
                }
            }).exec();

        if (currentVersion.childItems) {
            currentVersion.childItems.forEach(item => {
                const childContentLang = item.content?.contentLanguages?.find(contentLanguage => contentLanguage.language === language);
                item.content = this.mergeToContentLanguage(item.content, childContentLang)
            })
        }

        return this.mergeToContentVersion(currentContent, currentVersion);
    }

    /**
     * Get content detail without deep populate the child reference items
     * @param id The content id
     * @param language The language code (ex 'en', 'de'...)
     * @param statuses The array of statuses VersionStatus[]
     * @param fieldsSelect The Mongoose select field syntax (for example: `'_id name created'`)
     */
    async getContent(id: string, language: string, statuses?: number[], fieldsSelect?: string): Promise<T & P> {
        Validator.throwIfNull('contentId', id);

        if (!language) { language = this.EMPTY_LANGUAGE };
        const filter = { _id: id, isDeleted: false }
        const populateMatch = statuses ? { language, status: { $in: statuses } } : { language };

        let queryBuilder = this.findOne(filter as any, { lean: true });
        if (fieldsSelect) {
            queryBuilder = queryBuilder.select(fieldsSelect);
        }

        queryBuilder = queryBuilder.populate({
            path: 'contentLanguages',
            match: populateMatch,
            select: fieldsSelect
        })

        const currentContent = await queryBuilder.exec();
        Validator.throwIfNotFound('Content', currentContent, { _id: id, isDeleted: false, status: statuses });

        const contentLanguage = currentContent.contentLanguages.find((contentLang: P) => contentLang.language === language);
        Validator.throwIfNotFound('ContentLanguage', contentLanguage, { _id: id, isDeleted: false });

        return this.mergeToContentLanguage(currentContent, contentLanguage);
    }

    /**
     * Gets content children by parent id
     * @param parentId 
     * @param language 
     * @param [host] optional
     * @param [fieldsSelect] optional - The Mongoose select field syntax (for example: `'_id name created'`)
     * @returns The array of children 
     */
    async getContentChildren(parentId: string, language: string, host?: string, fieldsSelect?: string): Promise<Array<T & P>> {
        if (parentId == '0') parentId = null;

        const filter = { parentId: parentId, contentType: { $ne: null }, isDeleted: false };
        let queryBuilder = this.find(filter as any, { lean: true });
        if (fieldsSelect) {
            queryBuilder = queryBuilder.select(fieldsSelect);
        }

        queryBuilder = queryBuilder.populate({
            path: 'contentLanguages',
            match: { language },
            select: fieldsSelect
        })

        const contentChildren = await queryBuilder.exec();

        return contentChildren.map(x => {
            const contentLanguage = x.contentLanguages.find(contentLang => contentLang.language === language);
            return this.mergeToContentLanguage(x, contentLanguage);
        })
    }

    async getContentItems(id: string[], language: string, statuses?: number[], fieldsSelect?: string, isDeepPopulate: boolean = false): Promise<Array<T & P>> {
        Validator.throwIfNullOrEmpty('language', language);

        const filter = { _id: { $in: id }, isDeleted: false };
        const populateMatch = statuses ? { language, status: { $in: statuses } } : { language };

        let queryBuilder = this.find(filter as any, { lean: true });
        if (fieldsSelect) {
            queryBuilder = queryBuilder.select(fieldsSelect);
        }

        queryBuilder = queryBuilder.populate({
            path: 'contentLanguages',
            match: populateMatch,
            populate: isDeepPopulate ? this.deepPopulate(5, language) : undefined,
            select: fieldsSelect
        });
        const contents = await queryBuilder.exec();

        const publishedContents: Array<T & P> = [];
        contents.forEach(content => {
            const publishedLang = content.contentLanguages.find((contentLang: P) => contentLang.language === language) as P;
            publishedContents.push(this.mergeToContentLanguage(content, publishedLang));
        })

        return publishedContents;
    }

    private deepPopulate = (level: number, language: string, statuses?: number[], fieldsSelect?: string): { path: string, match: any, select?: string, populate?: any } => {
        const populateMatch = statuses ? { language, status: { $in: statuses } } : { language };
        if (level > 1) {
            return {
                path: 'childItems.content',
                match: { isDeleted: false },
                select: fieldsSelect,
                populate: {
                    path: 'contentLanguages',
                    match: populateMatch,
                    populate: this.deepPopulate(--level, language, statuses, fieldsSelect),
                    select: fieldsSelect
                }
            }
        } else if (level == 1) {
            return {
                path: 'childItems.content',
                match: { isDeleted: false },
                select: fieldsSelect,
                populate: {
                    path: 'contentLanguages',
                    match: populateMatch,
                    select: fieldsSelect
                }
            }
        }
        return null;
    }

    /**
     * Query content using aggregation function -> paginated results and a total count.
     * @param filter {FilterQuery<T & P>} The filter to query content
     * @param page {Number} Current page (default = 1)
     * @param limit {Number} Last row to return in results
     * @param sort {Object} sort query object such as `{ firstName: 'asc', lastName: -1 }`
     * @returns {Object} Object -> `{ rows, count }`
     */
    async queryContent(
        filter: FilterQuery<T & P>,
        page: number,
        limit: number,
        sort: { [key: string]: 'asc' | 'desc' | 1 | -1 },
        select?: string): Promise<Partial<PaginateResult>> {
        const skip = (page - 1) * limit;
        // IContent filter
        const { parentId, parentPath, contentType, isDeleted, deletedBy } = filter;
        // IContentLanguage filter
        const { contentId, versionId, language, name, properties, status } = filter;
        // aggregation query
        const queryBuilder = this.Model.aggregate<PaginateResult>()
            .match({ isDeleted, parentPath: { $regex: new RegExp(parentPath) } })
            .lookup({
                from: this.contentLanguageModel.collection.name,
                foreignField: 'contentId',
                localField: '_id',
                as: 'languageBranch'
            })
            .unwind('$languageBranch')
            .match({ "languageBranch.language": language })
            .project({ "contentLanguages": 0 })
            .facet({
                metadata: [{ $count: 'total' }],
                docs: [
                    // Since the name can be duplicated, adding createdAt to making sort is stable
                    { $sort: { "languageBranch.name": 1, createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    // merge language branch into the original document
                    { $replaceRoot: { newRoot: { $mergeObjects: ["$languageBranch", "$$ROOT"] } } },
                    { $project: { "languageBranch": 0 } }
                ]
            })
            // after $facet, its output {metadata: [ { total: 10000 } ],docs: [ { x }, { y }, ... ]}
            .unwind('$metadata')
            .project({
                docs: 1,
                // Get total from the first element of the metadata array 
                // total: { $arrayElemAt: [ '$metadata.total', 0 ] }
                total: '$metadata.total',
                pages: {
                    $ceil: {
                        $divide: ['$metadata.total', limit]
                    }
                }
            });

        //  [{ total: 10000, pages: 35,  docs: [ { x }, { y }, ... ]  }] // output
        const result = await queryBuilder;
        return result && result.length > 0 ? result[0] : {
            docs: [],
            total: 0,
            pages: 0
        }
    }

    /**
     * Create block or media content
     * @param content 
     */
    async executeCreateContentFlow(content: T & P, language: string, userId: string): Promise<T & V> {
        const parentContent = await this.findById(content.parentId).exec();
        //Step1: Create content
        content.masterLanguageId = language;
        const savedContent = await this.createContent(content, parentContent, userId);
        //Step2: Create content version
        const savedContentVersionDoc = await this.contentVersionService.createNewVersion(content as any, savedContent._id.toString(), userId, language);
        //Step3: update primary version
        await this.contentVersionService.setPrimaryVersion(savedContentVersionDoc._id.toString());
        //Step3: Create content in language 
        const savedContentLangDoc = await this.contentLanguageService.createContentLanguage(content, savedContent._id.toString(), savedContentVersionDoc._id.toString(), userId, language);

        return this.mergeToContentVersion(savedContent, savedContentVersionDoc);
    }

    protected createContent = (newContent: T, parentContent: T, userId: string): Promise<T> => {
        newContent.createdBy = userId;
        newContent.parentId = parentContent ? parentContent._id : null;

        //create parent path ids
        if (parentContent) {
            newContent.parentPath = parentContent.parentPath ? `${parentContent.parentPath}${parentContent._id},` : `,${parentContent._id},`;

            const ancestors = parentContent.ancestors.slice();
            ancestors.push(parentContent._id.toString());
            newContent.ancestors = ancestors
        } else {
            newContent.parentPath = null;
            newContent.ancestors = [];
        }

        return this.create(newContent);
    }

    protected updateHasChildren = async (content: IContentDocument): Promise<boolean> => {
        if (!content) return false;
        if (content && content.hasChildren) return true;

        content.hasChildren = true;
        const savedContent = await content.save();
        return savedContent.hasChildren;
    }

    /**
     * Execute update content flow of content service
     * @returns the newest version in current language
     */
    public executeUpdateContentFlow = async (id: string, versionId: string, userId: string, contentObj: T & V): Promise<T & V> => {
        //Step1: Get current version
        const currentVersion = await this.contentVersionService.getVersionById(versionId);
        const currentContent = currentVersion.contentId as T;
        const { language } = currentVersion;

        const isDraftVersion = VersionStatus.isDraftVersion(currentVersion.status);
        if (isDraftVersion) {
            //Step1: update corresponding content language if this language is not publish yet
            const contentLanguage = await this.contentLanguageService.findOne({ contentId: id, language } as any).exec();
            Validator.throwIfNotFound('ContentLanguage', contentLanguage, { contentId: id, language });

            if (VersionStatus.isDraftVersion(contentLanguage.status)) {
                Object.assign(contentLanguage, contentObj, { updatedBy: userId });
                await contentLanguage.save();
            }
            //Step2: update current version
            Object.assign(currentVersion, contentObj, { savedAt: new Date(), updatedBy: userId, savedBy: userId });
            const saveContentVersion = await currentVersion.save();

            return this.mergeToContentVersion(currentContent, saveContentVersion);
        } else {
            //Create new version from current version
            const newContentVersion = Object.assign(currentVersion.toJSON(), contentObj)
            const savedContentVersionDoc = await this.contentVersionService.createNewVersion(newContentVersion, id, userId, language, currentVersion._id.toString());
            //Check if there is any draft version which marked as primary
            const primaryDraftVersion = await this.contentVersionService.getPrimaryDraftVersion(id, language);
            //If there is not any primary draft version --> update primary version 
            if (!primaryDraftVersion) {
                await this.contentVersionService.setPrimaryVersion(savedContentVersionDoc._id.toString());
            }
            return this.mergeToContentVersion(currentContent, savedContentVersionDoc);
        }
    }

    /**
     * Execute publish content flow of content service
     * @returns the published version in current language
     */
    async executePublishContentFlow(id: string, versionId: string, userId: string, host?: string): Promise<T & V> {
        //Step1: Get current version
        const currentVersion = await this.contentVersionService.getVersionById(versionId);
        const currentContent = currentVersion.contentId as T;
        const { language } = currentVersion;

        const isDraftVersion = VersionStatus.isDraftVersion(currentVersion.status);
        if (isDraftVersion) {
            //Step2: publish the current version
            currentVersion.status = VersionStatus.Published;
            currentVersion.startPublish = new Date();
            currentVersion.publishedBy = userId;
            currentVersion.savedAt = new Date();
            currentVersion.savedBy = userId;
            currentVersion.masterVersionId = null;

            await currentVersion.save();

            //Step3: override the content language by publish version
            const contentLanguage = await this.contentLanguageService.findOne({ contentId: id, language: language } as any).exec();
            const previousVersionId = contentLanguage.versionId;

            const { status, startPublish, publishedBy, name, properties, childItems, _id } = currentVersion;
            const pageObject = pick(currentVersion, ['urlSegment', 'simpleAddress', 'visibleInMenu']);
            Object.assign(contentLanguage, pageObject, { status, startPublish, publishedBy, name, properties, childItems, versionId: _id.toString() });
            await contentLanguage.save();

            //Step3: update previous version to PreviewPublished
            if (previousVersionId != currentVersion._id.toString()) await this.contentVersionService.updateById(previousVersionId, { status: VersionStatus.PreviouslyPublished } as any);
        }

        return this.mergeToContentVersion(currentContent, currentVersion);
    }

    /**
     * Execute delete content flow of content service
     */
    public executeMoveContentToTrashFlow = async (id: string, userId: string): Promise<T> => {
        //find page
        const currentContent = await this.findById(id).exec();
        if (!currentContent) throw new DocumentNotFoundException(id);
        const result: [T, any] = await Promise.all([
            //soft delete page
            this.softDeleteContent(currentContent, userId),
            //soft delete page's children
            this.softDeleteContentChildren(currentContent, userId)
        ]);

        //update the 'HasChildren' field of page's parent
        const childCount = await this.countChildrenOfContent(currentContent);
        if (childCount == 0) await this.updateById(currentContent.parentId, { hasChildren: false } as any)

        return result[0];
    }

    private countChildrenOfContent = (currentContent: T): Promise<number> => {
        // In case delete content: page, block, media
        if (currentContent.contentType) {
            return this.count({ parentId: currentContent.parentId, isDeleted: false } as any)
        }
        // In case delete folder
        return this.count({ parentId: currentContent.parentId, isDeleted: false, contentType: null } as any)
    }

    private softDeleteContent = async (currentContent: T, userId: string): Promise<T> => {
        currentContent.isDeleted = true;
        currentContent.deletedBy = userId;
        currentContent.deletedAt = new Date();
        return currentContent.save();
    }

    private softDeleteContentChildren = (currentContent: T, userId: string): Promise<any> => {
        if (!currentContent.parentPath) currentContent.parentPath = ',';

        const startWithParentPathRegExp = new RegExp("^" + `${currentContent.parentPath}${currentContent._id},`);
        const conditions = { parentPath: { $regex: startWithParentPathRegExp } };
        const updateFields: Partial<IContentDocument> = { isDeleted: true, deletedBy: userId, deletedAt: new Date() };
        return this.updateMany(conditions as any, updateFields as any).exec()
    }

    /**
     * Execute the copy content flow
     * @param sourceContentId 
     * @param targetParentId 
     */
    public executeCopyContentFlow = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        const copiedContent = await this.createCopiedContent(sourceContentId, targetParentId, userId);
        await this.createCopiedChildrenContent(sourceContentId, copiedContent, userId);

        return copiedContent;
    }

    private createCopiedContent = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        //get source content 
        const sourceContent = await this.findById(sourceContentId, { lean: true }).exec();
        if (!sourceContent) throw new DocumentNotFoundException(sourceContentId);

        //get source latest version content in each language
        const sourceVersions = await this.contentVersionService.find({ contentId: sourceContent._id } as any, { lean: true }).exec();

        const latestVersion: { [key: string]: V } = {};
        sourceVersions.forEach(version => {
            const previousVer = latestVersion[version.language]
            if (!previousVer) {
                latestVersion[version.language] = version;
                return;
            }
            if (previousVer.language === version.language && previousVer.createdAt < version.createdAt)
                latestVersion[version.language] = version;
        })
        const copyVersions = Object.entries(latestVersion).map(([language, version]: [string, V]) => version);

        //create copy content
        const newContent = sourceContent.toObject();
        newContent._id = undefined;
        newContent.parentId = targetParentId;
        const parentContent = await this.findById(targetParentId).exec();
        const copiedContent = await this.createContent(newContent, parentContent, userId);

        //create copy content version and content lang
        copyVersions.forEach(async version => {
            const savedVersion = await this.contentVersionService.createNewVersion(version.toObject(), copiedContent._id.toString(), userId, version.language);
            const savedContentLang = await this.contentLanguageService.createContentLanguage(version.toObject(), copiedContent._id.toString(), savedVersion._id.toString(), userId, version.language);
        })

        return copiedContent;
    }

    private createCopiedChildrenContent = async (sourceContentId: string, copiedContent: T, userId: string): Promise<any> => {
        //get children
        const children = await this.find({ parentId: sourceContentId } as any, { lean: true }).exec();
        children.forEach(async childContent => {
            await this.executeCopyContentFlow(childContent._id, copiedContent._id, userId)
        })
    }

    private getDescendants = async (parentId: string): Promise<T[]> => {
        //get source content 
        const parentContent = await this.findById(parentId).exec();
        if (!parentContent) throw new DocumentNotFoundException(parentId);
        if (!parentContent.parentPath) parentContent.parentPath = ',';

        const startWithParentPathRegExp = new RegExp("^" + `${parentContent.parentPath}${parentContent._id},`);
        const conditions = { parentPath: { $regex: startWithParentPathRegExp } };
        return this.find(conditions as any).exec();
    }

    /**
     * Execute Cut content flow
     * @param sourceContentId 
     * @param targetParentId 
     */
    public executeCutContentFlow = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        const cutContent = await this.createCutContent(sourceContentId, targetParentId, userId);

        const cutResult = await this.createCutDescendantsContent(sourceContentId, cutContent);
        return cutContent;
    }

    protected createCutContent = async (sourceContentId: string, targetParentId: string, userId: string): Promise<T> => {
        //get source content 
        const sourceContent = await this.findById(sourceContentId).exec();
        if (!sourceContent) throw new DocumentNotFoundException(sourceContentId);

        const targetParent = await this.findById(targetParentId).exec();

        Object.assign(sourceContent, this.getNewParentPathAndAncestor(targetParent, sourceContent));
        sourceContent.updatedBy = userId;
        const updatedContent = await sourceContent.save();
        return updatedContent;
    }

    private createCutDescendantsContent = async (sourceContentId: string, cutContent: T): Promise<[T[], any]> => {
        //get descendants of sourceContent
        const descendants = await this.getDescendants(sourceContentId);
        if (descendants.length == 0) return [descendants, null];

        descendants.forEach(childContent => {
            Object.assign(childContent, this.getNewParentPathAndAncestor(cutContent, childContent));
            childContent.updatedBy = cutContent.updatedBy;
        })

        const updateOperators = descendants.map(x => ({
            updateOne: {
                filter: { _id: x._id },
                update: x.toObject()
            }
        }));

        const bulkWriteResult = await this.Model.bulkWrite([updateOperators], { ordered: false });
        return [descendants, bulkWriteResult];
    }

    private getNewParentPathAndAncestor = (newParentContent: T, currentContent: T): { parentId: string, parentPath: string, ancestors: string[] } => {
        const parentId = newParentContent ? newParentContent._id : null;
        const index = parentId ? currentContent.ancestors.findIndex(p => p == parentId) : 0;

        //update parent path, ancestors
        const paths = currentContent.parentPath.split(',').filter(x => x);
        let newPath = newParentContent && newParentContent.parentPath ? newParentContent.parentPath : ',';
        let newAncestors = newParentContent ? newParentContent.ancestors.slice() : [];

        for (let i = index; i < currentContent.ancestors.length; i++) {
            newPath = `${newPath}${paths[i]},`;
            newAncestors.push(currentContent.ancestors[i]);
        }

        return {
            parentPath: newPath,
            ancestors: newAncestors,
            parentId: parentId
        };
    }

    protected mergeToContentVersion(content: T, contentVersion: V): T & V {
        const contentJson = content && typeof content.toJSON === 'function' ? content.toJSON() : content;
        const contentVersionJson = contentVersion && typeof contentVersion.toJSON === 'function' ? contentVersion.toJSON() : contentVersion;
        const contentVersionData: T & V = Object.assign(contentVersionJson ?? {}, contentJson, { versionId: contentVersionJson?._id?.toString() });
        delete contentVersionData.contentLanguages;
        delete contentVersionData.contentId;
        return contentVersionData;
    }
}