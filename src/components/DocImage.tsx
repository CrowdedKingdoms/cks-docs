import useBaseUrl from '@docusaurus/useBaseUrl';

type Props = {
  src: string;
  alt: string;
};

/** Doc screenshot with eager loading so images below the fold render immediately. */
export default function DocImage({src, alt}: Props) {
  return (
    <img
      src={useBaseUrl(src)}
      alt={alt}
      loading="eager"
      decoding="async"
      className="doc-screenshot"
    />
  );
}
