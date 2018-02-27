import getters from './getters'

export default {
  namespaced: true,
  state: {
    banners: {
      'mainBanner': {
        'title': 'Luma Performance',
        'subtitle': 'Collection',
        'image': '/assets/slide_02.jpg',
        'link': '/c/women-20'
      },
      'smallBanners': [
        {
          'title': 'Erin Renny',
          'subtitle': 'New',
          'image': '/assets/ig/ig03.jpg',
          'link': '/c/men-11'
        },
        {
          'title': 'Eco-friendly',
          'subtitle': 'Sales',
          'image': '/assets/ig/ig05.jpg',
          'link': '/c/gear-3'
        }
      ],
      'productBanner': {
        'title': 'Eco-friendly',
        'subtitle': 'Sales',
        'image': '/assets/ig/ig05.jpg',
        'link': '/c/gear-3'
      }
    }

  },
  getters
}
