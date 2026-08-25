// A tag-projected cluster. memberIds are the takeaway/note node ids whose
// source carries this tag; the draw loop averages their live positions into
// a centroid. sourceIds tracks the underlying sources so a tag selection can
// highlight both the children and the source rings.
export interface TagCluster {
  tagId: number;
  label: string;
  memberIds: string[];
  sourceIds: number[];
}
