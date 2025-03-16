<script setup lang="ts">
import { onMounted, ref } from 'vue'


const username = ref(sessionStorage.getItem('username') || `User-${Math.random().toString(36).substring(2, 10)}`)

const saveUsernameToSessionStorage = (username: string) => {
  sessionStorage.setItem('username', username)
}

onMounted(() => {
  saveUsernameToSessionStorage(username.value)
})
</script>

<template>
  <div>
    <label>Username: <input type=" text" v-model="username" @input="(e) => {
      saveUsernameToSessionStorage((e.target as HTMLInputElement).value)
    }
    " /></label>
    <p></p>
  </div>
  <AvailableRooms :username="username" />
</template>