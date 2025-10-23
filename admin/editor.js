export function initEditor(type) {
  const defaults = {
    text: { type: 'text', props: { content: '<p>Nouveau paragraphe.</p>' } },
    hero: {
      type: 'hero',
      props: {
        title: 'Titre hero',
        subtitle: 'Sous-titre inspirant',
        cta: 'En savoir plus',
        ctaLink: '#'
      }
    },
    image: {
      type: 'image',
      props: {
        src: 'https://placehold.co/800x400',
        alt: 'Image',
        caption: ''
      }
    }
  };
  return JSON.parse(JSON.stringify(defaults[type] || defaults.text));
}
