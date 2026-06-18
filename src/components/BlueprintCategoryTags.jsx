import {
  BLUEPRINT_TAG_CHIP_CLASS,
  getBlueprintDisplayTags,
} from '../lib/blueprintTaxonomy'

const SIZE_CLASS = {
  sm: 'px-1.5 py-0.5 rounded text-[10px] border',
  md: 'px-2.5 py-1 rounded-lg text-sm border',
}

export default function BlueprintCategoryTags({ blueprint, size = 'sm', className = '' }) {
  const tags = getBlueprintDisplayTags(blueprint)
  if (!tags.length) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`.trim()}>
      {tags.map((tag) => (
        <span
          key={`${tag.kind}-${tag.label}`}
          className={`${SIZE_CLASS[size]} ${BLUEPRINT_TAG_CHIP_CLASS[tag.kind]}`}
        >
          {tag.label}
        </span>
      ))}
    </div>
  )
}
