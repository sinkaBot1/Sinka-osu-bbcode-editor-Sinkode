export type TagName =
  | 'b'
  | 'i'
  | 'u'
  | 's'
  | 'color'
  | 'size'
  | 'url'
  | 'img'
  | 'email'
  | 'youtube'
  | 'audio'
  | 'imagemap'
  | 'centre'
  | 'code'
  | 'c'
  | 'quote'
  | 'list'
  | 'spoiler'
  | 'spoilerbox'
  | 'heading'
  | 'notice'
  | 'box'
  | 'profile'

export interface TagDefinition {
  readonly name: TagName
  readonly aliases: readonly string[]
  readonly description: string
  readonly hasClosingTag: boolean
  readonly allowsValue: boolean
  readonly parameterRequirement: 'none' | 'optional' | 'required'
  readonly completionVisible: boolean
  readonly toolbarVisible: boolean
  readonly helpVisible: boolean
  readonly blockLevel: boolean
  readonly parseInner: boolean
  readonly prohibitsNewlines: boolean
}
