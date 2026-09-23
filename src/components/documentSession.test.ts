import { describe, expect, it } from 'vitest'
import { GENERATOR_REGISTRY } from '../generators/registry'
import { buildProjectDocument, serializeJsonValue } from '../shared/project/document'
import { documentGenerator, prepareNewDocument, prepareOpenedDocument } from './documentSession'

describe('single document lifecycle', () => {
  it.each(GENERATOR_REGISTRY.registrations.filter((entry) => documentGenerator(entry.id).projectCodec).map((entry) => entry.id))('opens %s using the file type and preserves settings', (id) => {
    const generator = documentGenerator(id)
    const initial = generator.createSession(18)
    const project = buildProjectDocument(generator.projectCodec!, initial.parameters, 18, {
      pixelsPerUnit: 64, guid: 'b93362e4a2b3bc240b452b57b97a4147',
    })
    const opened = prepareOpenedDocument(serializeJsonValue(project))
    expect(opened.session.generatorId).toBe(id)
    expect(opened.session.previewFps).toBe(18)
    expect(opened.session.frameIndex).toBe(0)
    expect(opened.session.frames.read().length).toBe(initial.frames.read().length)
    expect(opened.unitySettings).toEqual({ pixelsPerUnit: 64, stableGuid: 'b93362e4a2b3bc240b452b57b97a4147' })
    expect(generator.projectCodec!.serialize(opened.session.parameters)).toEqual(project.parameters)
  })

  it('creates a fresh document of the same type with default timing and export settings', () => {
    const first = prepareNewDocument('flame')
    const second = prepareNewDocument('flame')
    expect(second.session).not.toBe(first.session)
    expect(second.session.frames).not.toBe(first.session.frames)
    expect(second.session.previewFps).toBe(12)
    expect(second.session.frameIndex).toBe(0)
    expect(second.unitySettings.stableGuid).toBe('')
  })

  it.each(['not json', '{}', '{"generator":"__proto__"}', '{"generator":"flame","schema":"wrong"}'])('rejects invalid input before a replacement is available: %s', (text) => {
    expect(() => prepareOpenedDocument(text)).toThrow()
  })

  it('rejects unsupported project versions and invalid parameters', () => {
    const generator = documentGenerator('flame')
    const project = buildProjectDocument(generator.projectCodec!, generator.createSession(12).parameters, 12, { pixelsPerUnit: 100, guid: null })
    expect(() => prepareOpenedDocument(JSON.stringify({ ...project, version: 99 }))).toThrow()
    expect(() => prepareOpenedDocument(JSON.stringify({ ...project, parameters: null }))).toThrow()
  })
})
