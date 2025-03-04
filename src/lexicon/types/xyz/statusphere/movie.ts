/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../lexicons'
import { isObj, hasProp } from '../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  name: string
  rate: '0.5' | '1' | '1.5' | '2' | '2.5' | '3' | '3.5' | '4' | '4.5' | '5'
  watchedBefore: boolean
  liked: boolean
  review: string
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'xyz.statusphere.movie#main' ||
      v.$type === 'xyz.statusphere.movie')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('xyz.statusphere.movie#main', v)
}
