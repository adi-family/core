/**
 * File Spaces handlers using @adi/http system
 */

import type { Sql } from 'postgres'
import { handler } from '@adi-family/http'
import {
  listFileSpacesConfig
} from '@adi/api-contracts/file-spaces'
import * as fileSpaceQueries from '@db/file-spaces'

export function createFileSpaceHandlers(sql: Sql) {
  const listFileSpaces = handler(listFileSpacesConfig, async (ctx) => {
    const { project_id } = ctx.query || {}

    if (project_id) {
      const fileSpaces = await fileSpaceQueries.findFileSpacesByProjectId(sql, project_id)
      return fileSpaces
    }

    const fileSpaces = await fileSpaceQueries.findAllFileSpaces(sql)
    return fileSpaces
  })

  return {
    listFileSpaces
  }
}
