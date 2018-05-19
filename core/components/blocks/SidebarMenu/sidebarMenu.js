import Vue from 'vue'
import { mapState } from 'vuex'

export default Vue.component('SidebarMenu', {
  computed: {
    categories () {
      return this.$store.state.category.list.filter((op) => {
        return op.level === 2 // display only the root level (level =1 => Default Category)
      })
    },
    ...mapState({
      isOpen: state => state.ui.sidebar
    })
  },
  created () {
    this.$store.dispatch('category/list', {})
  },
  methods: {
    closeMenu () {
      this.$store.commit('ui/setSidebar', false)
      this.$store.commit('ui/setMicrocart', false)
    }
  }
})
