/**
 * Class type declaration
 *
 * T can be a interface which the class must implemented
 *
 * T can be a class which the class must extend or has the same signature (equal)
 *
 * T can be `any` to indicate the class don't need implement any interface or extend any base class
 */
export type ClassOf<T> = new (...args: any[]) => T;

/**
 * Object.prototype
 */
export type CmsObject = { [key: string]: any };

export type CmsTab = {
    /**
     * The tab name
     */
    name: string,
    /**
     * The title of each tab
     */
    title: string,
    /**
     * The number of area in each tab
     */
    areas: number
};

/**
 * Contains information to reference `Cms Url` instance
 */
export type CmsUrl = {
    url: string,
    text: string
    target: '_blank ' | '_self' | '_parent' | '_top'
};

/**
 * The type of content such as `page`, `block`, `media`, `folder_block`, `folder_media`
 */
export type TypeOfContent = 'page' | 'block' | 'media' | 'folder_block' | 'folder_media' | string;

export enum TypeOfContentEnum {
    Page = 'page',
    PagePartial = 'page_partial',
    Block = 'block',
    Media = 'media',
    FolderBlock = 'folder_block',
    FolderMedia = 'folder_media'
}
